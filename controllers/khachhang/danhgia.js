const Order = require('../../models/Order');
const Review = require('../../models/Review');
const Product = require('../../models/Product');

/**
 * @route   POST /api/khachhang/danh-gia
 * @desc    Tạo đánh giá / bình luận mới cho một sản phẩm trong đơn hàng đã hoàn thành
 */
const createReview = async (req, res) => {
  try {
    const user_id = req.user ? req.user.id : req.body.user_id;
    const { order_id, product_id, rating, comment_text } = req.body;

    // 1. Kiểm tra đầu vào bắt buộc
    if (!user_id || !order_id || !product_id || !rating) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp đầy đủ thông tin: Người dùng, Đơn hàng, Sản phẩm và Số sao!"
      });
    }

    // 2. Kiểm tra tính hợp lệ của số sao (Chấp nhận số lẻ bước nhảy 0.5 như 1.5, 2.5...)
    const numRating = Number(rating);
    if (isNaN(numRating) || numRating < 1 || numRating > 5 || numRating % 0.5 !== 0) {
      return res.status(400).json({
        success: false,
        message: "Số sao đánh giá không hợp lệ! Phải từ 1 đến 5 và là bội số của 0.5."
      });
    }

    // 3. Xác thực đơn hàng hợp lệ (Phải hoàn thành và chứa sản phẩm được chỉ định)
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

    // 4. Tiến hành lưu bản ghi mới vào CSDL
    const newReview = new Review({
      user_id,
      order_id,
      product_id,
      rating: numRating,
      comment_text: comment_text ? comment_text.trim() : ""
    });

    await newReview.save();

    // 5. Tự động tính toán lại và cập nhật rating tổng quan cho bảng Product
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
          rating_average: Math.round(stats[0].avgRating * 2) / 2, // Làm tròn đến mốc 0.5 gần nhất
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
    // Xử lý chặn trùng lặp đánh giá theo bộ chỉ mục Unique Index mới (user_id + order_id + product_id)
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


// Trích đoạn logic trong controllers/khachhang/danhgia.js
const getProductReviews = async (req, res) => {
  try {
    const { product_id } = req.params;
    
    // Tìm review của sản phẩm và nạp thêm thông tin full_name của User
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
 * @desc    Lấy danh sách đơn hàng kèm trạng thái đánh giá chi tiết từng sản phẩm (Đã tối ưu O(1))
 */
const getOrders = async (req, res) => {
  try {
    const { user_id } = req.query;
    if (!user_id) {
      return res.status(400).json({ success: false, message: "Thiếu user_id!" });
    }

    // 1. Lấy tất cả các đơn hàng thuộc về user này
    const orders = await Order.find({ customer_id: user_id })
      .sort({ createdAt: -1 })
      .lean();

    // 2. Gom tất cả ID đơn hàng đã hoàn thành ('completed') để gộp truy vấn Review
    const completedOrderIds = orders
      .filter(order => order.status === 'completed')
      .map(order => order._id);

    // 3. Khởi tạo một Map tra cứu nhanh trên RAM để tránh vòng lặp dồn ép Database
    const reviewMap = new Map();

    if (completedOrderIds.length > 0) {
      const reviews = await Review.find({
        user_id: user_id,
        order_id: { $in: completedOrderIds }
      }).lean();

      // Lưu trữ cấu trúc key theo định dạng: "idĐơnHàng_idSảnPhẩm"
      reviews.forEach(rev => {
        if (rev.order_id && rev.product_id) {
          const searchKey = `${rev.order_id.toString()}_${rev.product_id.toString()}`;
          reviewMap.set(searchKey, rev);
        }
      });
    }

    // 4. Lập bản đồ đính kèm trạng thái bình luận vào từng Item của đơn hàng
    orders.forEach(order => {
      if (order.status === 'completed' && order.items) {
        order.items = order.items.map(item => {
          if (item.product_id) {
            const key = `${order._id.toString()}_${item.product_id.toString()}`;
            const matchedReview = reviewMap.get(key);

            if (matchedReview) {
              return {
                ...item,
                is_reviewed: true,
                my_review: {
                  rating: matchedReview.rating,
                  comment_text: matchedReview.comment_text
                }
              };
            }
          }
          // Trạng thái mặc định nếu sản phẩm này chưa từng được viết đánh giá
          return {
            ...item,
            is_reviewed: false,
            my_review: null
          };
        });
      }
    });

    return res.status(200).json({
      success: true,
      orders: orders
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