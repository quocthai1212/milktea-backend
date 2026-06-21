const mongoose = require('mongoose'); // Thêm mongoose để phục vụ ép kiểu ObjectId trong Aggregate
const Order = require('../../models/Order');
const Review = require('../../models/Review');
const Product = require('../../models/Product');
const BadWord = require('../../models/BadWord'); 

/**
 * @route   POST /api/khachhang/danh-gia
 * @desc    Tạo đánh giá / bình luận mới (Tự động kích hoạt AI phân tích ở tầng Model)
 */
const createReview = async (req, res) => {
  try {
    const user_id = req.user ? req.user.id : req.body.user_id;
    const { order_id, product_id, rating, comment_text, review_images } = req.body;

    // 1. Kiểm tra đầu vào bắt buộc
    if (!user_id || !order_id || !product_id || !rating) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp đầy đủ thông tin: Người dùng, Đơn hàng, Sản phẩm và Số sao!"
      });
    }

    // 2. Kiểm tra tính hợp lệ của số sao
    const numRating = Number(rating);
    if (isNaN(numRating) || numRating < 1 || numRating > 5 || numRating % 0.5 !== 0) {
      return res.status(400).json({
        success: false,
        message: "Số sao đánh giá không hợp lệ! Phải từ 1 đến 5 và là bội số của 0.5."
      });
    }

    // 3. Quét và chặn từ ngữ thô tục / cấm quy chuẩn cộng đồng
    if (comment_text && comment_text.trim() !== "") {
      const bannedWordsList = await BadWord.find().select('word').lean();
      
      if (bannedWordsList.length > 0) {
        const pattern = bannedWordsList.map(item => item.word.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|');
        const badWordRegex = new RegExp(`(${pattern})`, 'i');

        const match = comment_text.match(badWordRegex);
        if (match) {
          return res.status(400).json({
            success: false,
            message: `Bình luận của bạn chứa từ ngữ không phù hợp quy chuẩn cộng đồng ("${match[0]}"). Vui lòng chỉnh sửa lại.`
          });
        }
      }
    }

    // 4. Xác thực đơn hàng hợp lệ
    const hopLe = await Order.findOne({
      _id: order_id,
      customer_id: user_id,
      status: 'completed',
      'items.product_id': product_id
    });

    if (!hopLe) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền đánh giá sản phẩm này! Đơn hàng phải ở trạng thái hoàn thành và chứa sản phẩm bạn đã chọn."
      });
    }

    // 5. Tiến hành lưu bản ghi mới vào CSDL
    const newReview = new Review({
      user_id,
      order_id,
      product_id,
      rating: numRating,
      comment_text: comment_text ? comment_text.trim() : "",
      review_images: review_images || [] 
    });

    // 🔥 KÍCH HOẠT AI CHẠY NGẦM
    await newReview.save();

    // 6. Tự động tính toán lại và cập nhật rating tổng quan cho bảng Product
    try {
      const stats = await Review.aggregate([
        { $match: { product_id: newReview.product_id } },
        {
          $group: {
            _id: '$product_id',
            avgRating: { $avg: '$rating' },
            totalReviews: { $sum: 1 }
          }
        }
      ]);

      if (stats.length > 0) {
        await Product.findByIdAndUpdate(product_id, {
          rating_average: Math.round(stats[0].avgRating * 2) / 2, 
          review_count: stats[0].totalReviews
        });
      }
    } catch (err) {
      console.error("Lỗi cập nhật số sao tổng quan của sản phẩm:", err);
    }

    return res.status(201).json({
      success: true,
      message: "Đăng bình luận và đánh giá sản phẩm thành công!",
      review: newReview 
    });

  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Sản phẩm này trong đơn hàng hiện tại bạn đã tiến hành đánh giá rồi!"
      });
    }
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi xử lý đánh giá: " + error.message
    });
  }
};

/**
 * @route   GET /api/khachhang/danh-gia/:product_id
 * @desc    Lấy danh sách đánh giá của một sản phẩm (Tự động kèm kết quả AI trong dữ liệu)
 */
const getProductReviews = async (req, res) => {
  try {
    const { product_id } = req.params;
    
    const reviews = await Review.find({ product_id })
      .populate('user_id', 'full_name') 
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      reviews: reviews
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * @route   GET /api/khachhang/don-hang
 * @desc    Lấy danh sách đơn hàng kèm thông tin CHI NHÁNH và link ảnh từ trường avatar của Product
 */
const getOrders = async (req, res) => {
  try {
    const { user_id } = req.query;
    if (!user_id) {
      return res.status(400).json({ success: false, message: "Thiếu user_id!" });
    }

    if (!mongoose.isValidObjectId(user_id)) {
      return res.status(400).json({ success: false, message: "Định dạng user_id không hợp lệ!" });
    }

    // 1. Sử dụng Aggregate nâng cao để JOIN chi nhánh VÀ bảng Sản phẩm (Product)
    const orders = await Order.aggregate([
      { 
        $match: { 
          customer_id: new mongoose.Types.ObjectId(user_id) 
        } 
      },
      // Lookup 1: Lấy thông tin chi nhánh
      {
        $lookup: {
          from: 'shippingconfigs', 
          localField: 'branch_id', 
          foreignField: '_id',    
          as: 'branch_info'       
        }
      },
      {
        $unwind: {
          path: '$branch_info',
          preserveNullAndEmptyArrays: true 
        }
      },
      // 🔥 LOOKUP 2: Lấy dữ liệu sản phẩm gốc để bốc đường dẫn ảnh Cloudinary
      {
        $lookup: {
          from: 'products',
          localField: 'items.product_id',
          foreignField: '_id',
          as: 'db_products'
        }
      },
      { 
        $sort: { createdAt: -1 } 
      }
    ]);

    // 2. Lấy danh sách ID các đơn hàng hoàn thành để map trạng thái review món
    const completedOrderIds = orders
      .filter(order => order.status === 'completed')
      .map(order => order._id);

    const reviewMap = new Map();

    if (completedOrderIds.length > 0) {
      const reviews = await Review.find({
        user_id: user_id,
        order_id: { $in: completedOrderIds }
      }).lean();

      reviews.forEach(rev => {
        if (rev.order_id && rev.product_id) {
          const searchKey = `${rev.order_id.toString()}_${rev.product_id.toString()}`;
          reviewMap.set(searchKey, rev);
        }
      });
    }

    // 3. Chuẩn hóa dữ liệu đầu ra: Đính kèm ảnh từ CSDL vào từng item
    const formattedOrders = orders.map(order => {
      let updatedItems = order.items || [];
      const dbProducts = order.db_products || []; 
      
      updatedItems = updatedItems.map(item => {
        if (item.product_id) {
          // Khớp phần tử trong mảng với dữ liệu gốc của bảng Product
          const sanPhamGoc = dbProducts.find(p => p._id.toString() === item.product_id.toString());
          
          // 🔥 ĐỔI TẠI ĐÂY: Lấy trường .avatar của CSDL ném vào trường .product_image gửi về cho Client
          let baseItem = {
            ...item,
            product_image: sanPhamGoc?.avatar || item.product_image || item.avatar || ''
          };

          // Kiểm tra và đính kèm thông tin đánh giá nếu đơn hàng đã hoàn thành
          if (order.status === 'completed') {
            const key = `${order._id.toString()}_${item.product_id.toString()}`;
            const matchedReview = reviewMap.get(key);

            if (matchedReview) {
              return {
                ...baseItem,
                is_reviewed: true,
                my_review: {
                  rating: matchedReview.rating,
                  comment_text: matchedReview.comment_text,
                  ai_sentiment: matchedReview.ai_sentiment 
                }
              };
            }
          }

          return {
            ...baseItem,
            is_reviewed: false,
            my_review: null
          };
        }
        
        return item;
      });

      return {
        ...order,
        items: updatedItems,
        db_products: undefined, // Xóa mảng tạm này đi cho nhẹ data
        branch_id: order.branch_info ? {
          _id: order.branch_info._id,
          branch_name: order.branch_info.branch_name,
          shop_address: order.branch_info.shop_address
        } : null
      };
    });

    return res.status(200).json({
      success: true,
      orders: formattedOrders
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi tải danh sách đơn hàng: " + error.message
    });
  }
};

module.exports = {
  createReview,
  getProductReviews,
  getOrders
};