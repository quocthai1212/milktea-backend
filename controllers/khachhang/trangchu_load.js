// controllers/khachhang/tangchu_loadsp.js
const Product = require('../../models/Product'); 
const Category = require('../../models/Category'); 
const Review = require('../../models/Review'); // Đã map chuẩn xác với Model Review của bạn

const taiDanhSachSanPhamTrangChu = async (req, res) => {
  try {
    // 1. Lấy danh mục đang hoạt động
    const danhSachDM = await Category.find({ is_active: true }).sort({ createdAt: 1 });

    // 2. Lấy danh sách sản phẩm đang bán
    const danhSachSP = await Product.find({ is_active: true })
      .populate('category', 'category_name is_active') 
      .sort({ createdAt: -1 });

    // 3. Lọc an toàn các sản phẩm có danh mục hợp lệ
    const sanPhamHopLe = danhSachSP.filter(sp => {
      return !sp.category || sp.category.is_active === true;
    });

    // 4. 🔥 TÍNH TOÁN SAO TRUNG BÌNH DỰA TRÊN ĐÚNG SCHEMA REVIEW
    const sanPhamKemRating = await Promise.all(
      sanPhamHopLe.map(async (sp) => {
        const spObj = sp.toObject();

        // Tìm các review có product_id khớp với id sản phẩm
        const reviews = await Review.find({ product_id: sp._id });

        if (reviews && reviews.length > 0) {
          // Tính tổng số điểm dựa trên trường 'rating' trong schema của bạn
          const tongSao = reviews.reduce((sum, rev) => sum + (rev.rating || 5), 0);
          
          spObj.rating_average = Number((tongSao / reviews.length).toFixed(1)); // Ví dụ: 4.5
          spObj.review_count = reviews.length;
        } else {
          spObj.rating_average = 5.0; // Mặc định nếu chưa ai đánh giá
          spObj.review_count = 0;
        }

        return spObj;
      })
    );

    return res.status(200).json({
      success: true,
      categories: danhSachDM,   
      products: sanPhamKemRating
    });

  } catch (error) {
    console.error("❌ Lỗi xảy ra tại controller tangchu_loadsp:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể tải danh sách sản phẩm và danh mục.",
      error: error.message
    });
  }
};

module.exports = { taiDanhSachSanPhamTrangChu };