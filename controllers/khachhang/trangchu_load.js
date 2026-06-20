const Product = require('../../models/Product');     
const Category = require('../../models/Category');   
const Promotion = require('../../models/Promotion'); 
const Review = require('../../models/Review'); 
const Order = require('../../models/Order');
/**
 * Hàm dự phòng (Fallback): Chuyển đổi tên danh mục tiếng Việt có dấu thành tên thư mục viết thường, không dấu
 */
const xulyTenThuMucFallback = (str) => {
  if (!str) return 'ngon';
  return str
    .toLowerCase()
    .normalize('NFD')                  
    .replace(/[\u0300-\u036f]/g, '')   
    .replace(/đ/g, 'd')                
    .replace(/([^0-9a-z-\s])/g, '')    
    .replace(/(\s+)/g, '-')            
    .trim();
};

/**
 * API: Tải dữ liệu trang chủ
 * URL: GET /api/khachhang/sanpham
 */
const getTrangChuData = async (req, res) => {
  try {
    // 1. Lấy tất cả danh mục đang hoạt động
    const categories = await Category.find({ 
      is_active: true,
      category_name: { $ne: 'Topping' } 
    });

    // 2. Lấy tất cả sản phẩm đang hoạt động
    const productsRaw = await Product.find({ is_active: true })
      .populate('category')
      .lean(); 

    // Quét qua toàn bộ bảng Review để nhóm điểm đánh giá theo từng sản phẩm bằng Aggregation
    let reviewsAggregation = [];
    try {
      reviewsAggregation = await Review.aggregate([
        {
          $group: {
            _id: "$product_id", 
            rating_average: { $avg: "$rating" }, // Tính trung bình cộng số sao
            review_count: { $sum: 1 } // Tính tổng số lượt đánh giá
          }
        }
      ]);
    } catch (revErr) {
      console.log("⚠️ Lưu ý: Hệ thống chưa đồng bộ được bảng đánh giá:", revErr.message);
    }

    // Chuyển mảng Aggregation thành Map để việc tra cứu id sản phẩm đạt hiệu năng O(1)
    const reviewMap = new Map(reviewsAggregation.map(r => [r._id.toString(), r]));

    // 3. XỬ LÝ ĐỘNG TẤT CẢ THƯ MỤC CHỨA ẢNH & ĐÍNH KÈM SỐ SAO TRUNG BÌNH THỰC TẾ
    const products = productsRaw.map(sp => {
      let imagePath = 'https://placehold.co/300x300?text=No+Image'; 

      if (sp.avatar) {
        if (sp.avatar.includes('uploads/')) {
          imagePath = sp.avatar.startsWith('/') ? sp.avatar : `/${sp.avatar}`;
        } else if (sp.category) {
          const folderName = sp.category.folder_path ? sp.category.folder_path.trim() : xulyTenThuMucFallback(sp.category.category_name);
          imagePath = `/uploads/categories/${folderName}/${sp.avatar}`;
        } else {
          imagePath = `/uploads/${sp.avatar}`;
        }
      }

      let boSuuTapAnh = [];
      if (sp.images && sp.images.length > 0) {
        boSuuTapAnh = sp.images.map(img => {
          if (img.includes('uploads/')) {
            return img.startsWith('/') ? img : `/${img}`;
          }
          if (sp.category) {
            const folderName = sp.category.folder_path ? sp.category.folder_path.trim() : xulyTenThuMucFallback(sp.category.category_name);
            return `/uploads/categories/${folderName}/${img}`;
          }
          return `/uploads/${img}`;
        });
      }

      // 🌟 FIX TRIỆT ĐỂ TẠI ĐÂY: Trích xuất điểm sao từ bảng reviews
      const reviewInfo = reviewMap.get(sp._id.toString());
      
      // Nếu có đánh giá thì lấy giá trị đã tính, nếu CHƯA CÓ ai đánh giá thì mặc định là 0
      const rating_average = reviewInfo && reviewInfo.rating_average ? reviewInfo.rating_average : 0; 
      const review_count = reviewInfo && reviewInfo.review_count ? reviewInfo.review_count : 0;

      return {
        ...sp,
        image: imagePath,           
        images_gallery: boSuuTapAnh,
        rating_average: Number(Number(rating_average).toFixed(1)), // Làm tròn 1 chữ số thập phân (Ví dụ: 4.3333 -> 4.3)
        review_count: Number(review_count)
      };
    });

    // 4. Lấy danh sách các voucher khuyến mãi đang trong thời gian hiệu lực
    const currentDate = new Date();
    let promotions = [];
    try {
      promotions = await Promotion.find({
        is_active: true,
        start_date: { $lte: currentDate },
        end_date: { $gte: currentDate }
      });
    } catch (promoError) {
      console.log("⚠️ Lưu ý: Chưa lấy được danh sách Voucher:", promoError.message);
    }

    // 5. Trả dữ liệu về cho Frontend
    return res.status(200).json({
      success: true,
      message: "Tải dữ liệu thực đơn, chuẩn hóa ảnh và tính toán số sao trung bình thành công!",
      categories,
      products,
      promotions
    });

  } catch (error) {
    console.error("❌ Lỗi nghiêm trọng tại trangchu_load.js:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống không thể nạp thực đơn.",
      error: error.message
    });
  }
};
//Dùng khi chưa đăng nhập
const getBestSellers = async (limit = 5) => {
  return await Order.aggregate([
    { $match: { status: 'completed' } },
    { $unwind: "$items" },
    { $group: { _id: "$items.product_id", totalSold: { $sum: "$items.quantity" } } },
    { $sort: { totalSold: -1 } },
    { $limit: limit }
  ]);
};
//Dùng khi đã đăng nhập
const getCustomerFavorites = async (customerId, limit = 5) => {
  return await Order.aggregate([
    { $match: { customer_id: new mongoose.Types.ObjectId(customerId), status: 'completed' } },
    { $unwind: "$items" },
    { $group: { _id: "$items.product_id", count: { $sum: "$items.quantity" } } },
    { $sort: { count: -1 } },
    { $limit: limit }
  ]);
};

const getCustomerRecommendations = async (req, res) => {
  try {
      const { user_id } = req.query; 
      let recommendedIds = [];

      if (user_id && user_id !== 'null' && user_id !== 'undefined') {
          recommendedIds = await getCustomerFavorites(user_id, 5);
      } else {
          recommendedIds = await getBestSellers(5);
      }

      const productIds = recommendedIds.map(item => item._id);
      
      // THÊM .populate('category') để có thông tin folder_path phục vụ xử lý ảnh
      const productsRaw = await Product.find({ _id: { $in: productIds } })
                                      .populate('category')
                                      .lean();
      
      // 🌟 ĐÃ THÊM: Tính toán số sao bằng Aggregation từ bảng Review giới hạn trong danh sách ID gợi ý để tối ưu hóa tốc độ
      let reviewsAggregation = [];
      try {
        reviewsAggregation = await Review.aggregate([
          { $match: { product_id: { $in: productIds } } }, // Chỉ quét các sản phẩm nằm trong danh sách gợi ý
          {
            $group: {
              _id: "$product_id", 
              rating_average: { $avg: "$rating" },
              review_count: { $sum: 1 }
            }
          }
        ]);
      } catch (revErr) {
        console.log("⚠️ Lưu ý: Chưa đồng bộ được bảng đánh giá cho phần gợi ý:", revErr.message);
      }

      // Map hóa danh sách đánh giá
      const reviewMap = new Map(reviewsAggregation.map(r => [r._id.toString(), r]));

      // XỬ LÝ ẢNH & ĐÍNH KÈM THÔNG TIN ĐÁNH GIÁ ĐỒNG BỘ VỚI GETTRANGCHUDATA
      const products = productsRaw.map(sp => {
          // 1. Đồng bộ xử lý Avatar ảnh gốc
          let imagePath = 'https://placehold.co/300x300?text=No+Image'; 
          if (sp.avatar) {
              if (sp.avatar.includes('uploads/')) {
                  imagePath = sp.avatar.startsWith('/') ? sp.avatar : `/${sp.avatar}`;
              } else if (sp.category) {
                  const folderName = sp.category.folder_path ? sp.category.folder_path.trim() : xulyTenThuMucFallback(sp.category.category_name);
                  imagePath = `/uploads/categories/${folderName}/${sp.avatar}`;
              } else {
                  imagePath = `/uploads/${sp.avatar}`;
              }
          }

          // 2. Đồng bộ xử lý Thư viện ảnh gallery (Để khi click Modal chi tiết từ mục gợi ý không bị lỗi thiếu ảnh slider)
          let boSuuTapAnh = [];
          if (sp.images && sp.images.length > 0) {
            boSuuTapAnh = sp.images.map(img => {
              if (img.includes('uploads/')) {
                return img.startsWith('/') ? img : `/${img}`;
              }
              if (sp.category) {
                const folderName = sp.category.folder_path ? sp.category.folder_path.trim() : xulyTenThuMucFallback(sp.category.category_name);
                return `/uploads/categories/${folderName}/${img}`;
              }
              return `/uploads/${img}`;
            });
          }

          // 3. Trích xuất điểm sao từ reviewMap giống hệt getTrangChuData
          const reviewInfo = reviewMap.get(sp._id.toString());
          const rating_average = reviewInfo && reviewInfo.rating_average ? reviewInfo.rating_average : 0; 
          const review_count = reviewInfo && reviewInfo.review_count ? reviewInfo.review_count : 0;

          return { 
            ...sp, 
            image: imagePath,
            images_gallery: boSuuTapAnh,
            rating_average: Number(Number(rating_average).toFixed(1)), // Trả ra dạng float 1 chữ số thập phân (Ví dụ: 4.5)
            review_count: Number(review_count)
          };
      });
      
      return res.status(200).json({ success: true, products });
  } catch (error) {
      console.error("❌ Lỗi gợi ý:", error);
      return res.status(500).json({ success: false, message: error.message });
  }
};
module.exports = {
  getTrangChuData,
  getBestSellers,
  getCustomerFavorites,
  getCustomerRecommendations
};