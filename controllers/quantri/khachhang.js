const User = require('../../models/User'); 
const bcrypt = require('bcryptjs');

// =========================================================================
// 1. CHỨC NĂNG: LẤY DANH SÁCH TẤT CẢ KHÁCH HÀNG (role_id = 3)
// =========================================================================
exports.getKhachHang = async (req, res) => {
  try {
    // Tìm tài khoản khách hàng (role_id: 3), xếp người mới đăng ký lên đầu
    const danhSachKhachHang = await User.find({ role_id: 3 }).sort({ createdAt: -1 });
    
    return res.status(200).json({
      success: true,
      data: danhSachKhachHang
    });
  } catch (error) {
    return res.status(500).json({ 
      success: false, 
      message: "Lỗi hệ thống không thể tải danh sách khách hàng!", 
      error: error.message 
    });
  }
};

// =========================================================================
// 2. CHỨC NĂNG: THÊM KHÁCH HÀNG MỚI
// =========================================================================
exports.addKhachHang = async (req, res) => {
  try {
    const { full_name, email, password, phone, gender, is_vip, is_active } = req.body;

    if (!full_name || !email || !password) {
      return res.status(400).json({ success: false, message: "Vui lòng nhập đủ Họ tên, Email và Mật khẩu!" });
    }

    const emailDaTonTai = await User.findOne({ email: email.toLowerCase() });
    if (emailDaTonTai) {
      return res.status(400).json({ success: false, message: "Email này đã được đăng ký trên hệ thống!" });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordMaHoa = await bcrypt.hash(password, salt);

    const khachHangMoi = new User({
      full_name,
      email: email.toLowerCase(),
      password: passwordMaHoa,
      phone: phone || "",
      gender: gender || "Nam",
      role_id: 3, // Tự động gán quyền Khách hàng
      is_vip: is_vip !== undefined ? is_vip : false,
      is_active: is_active !== undefined ? is_active : true,
      shipping_addresses: []
    });

    await khachHangMoi.save();
    return res.status(201).json({ 
      success: true, 
      message: `Đã thêm tài khoản khách hàng ${full_name} thành công!`, 
      data: khachHangMoi 
    });

  } catch (error) {
    return res.status(500).json({ success: false, message: "Lỗi hệ thống không thể tạo khách hàng!", error: error.message });
  }
};

// =========================================================================
// 3. CHỨC NĂNG: CẬP NHẬT THÔNG TIN KHÁCH HÀNG (GỒM CẢ CHẶN / THAY ĐỔI TRẠNG THÁI)
// =========================================================================
exports.updateKhachHang = async (req, res) => {
  try {
    const { id } = req.params;
    // 🎯 Nhận is_active truyền từ Frontend lên để thực hiện khóa/mở khóa
    const { full_name, email, phone, gender, is_vip, is_active, password } = req.body;

    const khachHang = await User.findOne({ _id: id, role_id: 3 });
    if (!khachHang) {
      return res.status(404).json({ success: false, message: "Không tìm thấy khách hàng này!" });
    }

    // Kiểm tra trùng Email
    if (email && email.toLowerCase() !== khachHang.email) {
      const emailTrung = await User.findOne({ email: email.toLowerCase() });
      if (emailTrung) {
        return res.status(400).json({ success: false, message: "Email mới này đã thuộc về một tài khoản khác!" });
      }
      khachHang.email = email.toLowerCase();
    }

    // Cập nhật các trường thông tin cơ bản
    if (full_name) khachHang.full_name = full_name;
    if (phone !== undefined) khachHang.phone = phone;
    if (gender) khachHang.gender = gender;
    if (is_vip !== undefined) khachHang.is_vip = is_vip;
    
    // 🎯 Đổi trạng thái Hoạt động (true) / Bị chặn (false) ở đây
    if (is_active !== undefined) khachHang.is_active = is_active;

    // Đổi mật khẩu nếu cần
    if (password && password.trim() !== "") {
      const salt = await bcrypt.genSalt(10);
      khachHang.password = await bcrypt.hash(password, salt);
    }

    await khachHang.save();
    return res.status(200).json({ success: true, message: "Cập nhật thông tin khách hàng thành công!", data: khachHang });

  } catch (error) {
    return res.status(500).json({ success: false, message: "Lỗi hệ thống không thể sửa thông tin khách hàng!", error: error.message });
  }
};

// =========================================================================
// 4. CHỨC NĂNG: XÓA VĨNH VIỄN TÀI KHOẢN KHÁCH HÀNG
// =========================================================================
exports.deleteKhachHang = async (req, res) => {
  try {
    const { id } = req.params;

    const khachHangBiXoa = await User.findOneAndDelete({ _id: id, role_id: 3 });
    if (!khachHangBiXoa) {
      return res.status(404).json({ success: false, message: "Không tìm thấy khách hàng hợp lệ để xóa!" });
    }

    return res.status(200).json({ 
      success: true, 
      message: `Đã xóa hoàn toàn thông tin khách hàng ${khachHangBiXoa.full_name}!` 
    });

  } catch (error) {
    return res.status(500).json({ success: false, message: "Lỗi hệ thống không thể xóa khách hàng!", error: error.message });
  }
};