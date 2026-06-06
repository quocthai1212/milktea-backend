const Product = require('../../models/Product');

// 🔍 1. LẤY DANH SÁCH SẢN PHẨM (Dành cho trang Quản trị)
exports.getsanpham = async (req, res) => {
  try {
    const danhSach = await Product.find().sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: danhSach });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Lỗi không thể lấy danh sách món!", error: error.message });
  }
};

// ➕ 2. THÊM SẢN PHẨM MỚI (Bao gồm cả Toppings và Sizes nếu có)
exports.addsanpham = async (req, res) => {
  try {
    // ➕ Thêm "sizes" nhận về từ req.body
    const { product_name, base_price, image, category, description, is_active, toppings, sizes } = req.body;

    // Kiểm tra các trường bắt buộc theo Schema mới
    if (!product_name || !base_price || !category) {
      return res.status(400).json({ success: false, message: "Vui lòng nhập đầy đủ Tên món, Loại và Giá gốc!" });
    }

    const sanPhamMoi = new Product({
      product_name,
      base_price: Number(base_price),
      image: image || "",
      category,
      description: description || "",
      is_active: is_active !== undefined ? is_active : true,
      toppings: toppings || [], // Mảng toppings truyền lên dạng: [{topping_id: "...", topping_name: "...", price: 5000}]
      sizes: sizes || []        // ➕ Lưu mảng sizes truyền lên dạng: [{size_name: "Size L", extra_price: 5000}]
    });

    await sanPhamMoi.save();
    return res.status(201).json({ success: true, message: `Đã thêm món ${product_name} vào menu!`, data: sanPhamMoi });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Lỗi hệ thống không thể thêm món!", error: error.message });
  }
};

// ✏️ 3. SỬA THÔNG TIN SẢN PHẨM (Cập nhật giá gốc, trạng thái ẩn/hiện, toppings và sizes)
exports.updatesanpham = async (req, res) => {
  try {
    const { id } = req.params;
    // ➕ Thêm "sizes" nhận về từ req.body để phục vụ cập nhật
    const { product_name, base_price, image, category, description, is_active, toppings, sizes } = req.body;

    const sanPham = await Product.findById(id);
    if (!sanPham) {
      return res.status(404).json({ success: false, message: "Không tìm thấy món này!" });
    }

    // Cập nhật linh hoạt các trường dữ liệu mới
    if (product_name) sanPham.product_name = product_name;
    if (base_price !== undefined) sanPham.base_price = Number(base_price);
    if (image !== undefined) sanPham.image = image;
    if (category) sanPham.category = category;
    if (description !== undefined) sanPham.description = description;
    if (is_active !== undefined) sanPham.is_active = is_active;
    if (toppings !== undefined) sanPham.toppings = toppings; // Ghi đè hoặc cập nhật lại mảng topping mới
    if (sizes !== undefined) sanPham.sizes = sizes;       // ➕ Ghi đè hoặc cập nhật lại mảng kích thước (sizes) mới

    await sanPham.save();
    return res.status(200).json({ success: true, message: "Cập nhật món thành công!", data: sanPham });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Lỗi không thể cập nhật thông tin món!", error: error.message });
  }
};

// 🗑️ 4. XÓA SẢN PHẨM KHỎI MENU
exports.deletesanpham = async (req, res) => {
  try {
    const { id } = req.params;
    const sanPhamBiXoa = await Product.findByIdAndDelete(id);
    
    if (!sanPhamBiXoa) {
      return res.status(404).json({ success: false, message: "Không tìm thấy món để xóa!" });
    }
    return res.status(200).json({ success: true, message: `Đã xóa món ${sanPhamBiXoa.product_name} khỏi thực đơn!` });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Lỗi hệ thống không thể xóa món!", error: error.message });
  }
};