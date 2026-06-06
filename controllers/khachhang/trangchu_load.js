// controllers/khachhang/tangchu_loadsp.js
const Product = require('../../models/Product'); 
const Category = require('../../models/Category'); // ➕ Import thêm model Category để phối hợp lọc dữ liệu

// Hàm xử lý lấy đồng thời cả Danh mục và Sản phẩm hiển thị ra Trang Chủ khách hàng
const taiDanhSachSanPhamTrangChu = async (req, res) => {
  try {
    
    // 🎯 Lấy danh sách danh mục ĐANG HIỆN (is_active: true) hiển thị lên thanh Tabs
    // Sắp xếp theo thứ tự bảng chữ cái hoặc thời gian tạo (createdAt: 1)
    const danhSachDM = await Category.find({ is_active: true }).sort({ createdAt: 1 });

    // 🎯 Lấy danh sách sản phẩm ĐANG BÁN (is_active: true)
    // Populate lấy thêm thông tin tên và trạng thái hoạt động từ bảng Category
    const danhSachSP = await Product.find({ is_active: true })
      .populate('category', 'category_name is_active') 
      .sort({ createdAt: -1 });

    // 🎯 LỌC AN TOÀN: Loại bỏ sản phẩm thuộc về danh mục đã bị ADMIN ẨN (is_active: false)
    const sanPhamHopLe = danhSachSP.filter(sp => {
      // Nếu sản phẩm không gắn danh mục, hoặc danh mục cha của nó đang hoạt động (true) thì giữ lại
      return !sp.category || sp.category.is_active === true;
    });

    // 🎯 Gộp chung dữ liệu trả về cấu trúc JSON mới cho Frontend nhận lấy
    return res.status(200).json({
      success: true,
      categories: danhSachDM,   // Mảng danh mục hợp lệ (để map ra thanh cuộn Tabs)
      products: sanPhamHopLe    // Mảng sản phẩm hợp lệ kèm cấu trúc đầy đủ toppings và sizes
    });

  } catch (error) {
    console.error("❌ Lỗi xảy ra tại controller tangchu_loadsp:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể tải danh sách sản phẩm và danh mục. Vui lòng thử lại sau!",
      error: error.message
    });
  }
};

module.exports = {
  taiDanhSachSanPhamTrangChu
};