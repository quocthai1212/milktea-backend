// Thư mục hiện tại (quantri) đi ra bằng 2 dấu chấm để tìm thư mục models
const User = require('../../models/User'); 
const bcrypt = require('bcryptjs');

// =========================================================================
// 1. CHỨC NĂNG: LẤY DANH SÁCH SHIPPER (Chỉ lấy người có role_id = 4)
// =========================================================================
exports.getshipper = async (req, res) => {
  try {
    // Tìm tất cả người dùng có role_id là 4 (Shipper), sắp xếp tài xế mới tạo lên đầu
    const danhSach = await User.find({ role_id: 4 }).sort({ createdAt: -1 });
    
    return res.status(200).json({
      success: true,
      data: danhSach
    });
  } catch (error) {
    return res.status(500).json({ 
      success: false, 
      message: "Lỗi hệ thống không thể lấy danh sách tài xế!", 
      error: error.message 
    });
  }
};

// =========================================================================
// 2. CHỨC NĂNG: THÊM SHIPPER MỚI (Mặc định gán role_id = 4)
// =========================================================================
exports.adshipper = async (req, res) => {
  try {
    const { username, full_name, email, password, phone, cccd, birthday, gender, base_salary, is_active } = req.body;

    // Kiểm tra dữ liệu bắt buộc (Bổ sung username đồng bộ với frontend)
    if (!username || !full_name || !email || !password) {
      return res.status(400).json({ success: false, message: "Vui lòng nhập đầy đủ Tên đăng nhập, Họ tên, Email và Mật khẩu!" });
    }

    // Kiểm tra trùng username hoặc email
    const taiKhoanDaTonTai = await User.findOne({ 
      $or: [
        { username: username.toLowerCase() },
        { email: email.toLowerCase() }
      ] 
    });

    if (taiKhoanDaTonTai) {
      return res.status(400).json({ success: false, message: "Tên đăng nhập hoặc Email tài xế đã tồn tại trên hệ thống!" });
    }

    // Mã hóa mật khẩu bảo mật
    const saltRound = 10;
    const matKhauMaHoa = await bcrypt.hash(password, saltRound);

    const shipperMoi = new User({
      username: username.toLowerCase(),
      full_name,
      email: email.toLowerCase(),
      password: matKhauMaHoa,
      phone: phone || "",
      cccd: cccd || "",
      birthday: birthday || "",
      gender: gender || "Nam",
      role_id: 4, // 🎯 Tự động gán quyền Shipper (Tài xế giao hàng)
      base_salary: base_salary || 25000,
      is_active: is_active !== undefined ? is_active : true,
      shipping_addresses: [],
      attendance: []
    });

    await shipperMoi.save();
    return res.status(201).json({ success: true, message: `Đã thêm tài xế ${full_name}!`, data: shipperMoi });

  } catch (error) {
    return res.status(500).json({ success: false, message: "Lỗi hệ thống không thể thêm tài xế mới!", error: error.message });
  }
};

// =========================================================================
// 3. CHỨC NĂNG: CHỈNH SỬA THÔNG TIN SHIPPER (Dựa vào ID trên URL)
// =========================================================================
exports.updateshipper = async (req, res) => {
  try {
    const { id } = req.params; 
    const { full_name, email, phone, cccd, birthday, gender, base_salary, is_active, password } = req.body;

    const shipper = await User.findById(id);
    if (!shipper) {
      return res.status(404).json({ success: false, message: "Không tìm thấy thông tin tài xế này!" });
    }

    // Kiểm tra trùng email mới nếu có thay đổi
    if (email && email.toLowerCase() !== shipper.email) {
      const emailTrung = await User.findOne({ email: email.toLowerCase() });
      if (emailTrung) {
        return res.status(400).json({ success: false, message: "Email mới này đã có tài xế khác sử dụng!" });
      }
      shipper.email = email.toLowerCase();
    }

    // Cập nhật các trường thông tin
    if (full_name) shipper.full_name = full_name;
    if (phone !== undefined) shipper.phone = phone;
    if (cccd !== undefined) shipper.cccd = cccd;
    if (birthday !== undefined) shipper.birthday = birthday;
    if (gender) shipper.gender = gender;
    if (base_salary) shipper.base_salary = base_salary;
    if (is_active !== undefined) shipper.is_active = is_active;
    
    // Đảm bảo role_id không bị thay đổi lung tung
    shipper.role_id = 4;

    // Sửa mật khẩu nếu có nhập mật khẩu mới
    if (password && password.trim() !== "") {
      const saltRound = 10;
      shipper.password = await bcrypt.hash(password, saltRound);
    }

    await shipper.save();
    return res.status(200).json({ success: true, message: "Cập nhật thông tin tài xế thành công!", data: shipper });

  } catch (error) {
    return res.status(500).json({ success: false, message: "Lỗi hệ thống không thể sửa thông tin tài xế!", error: error.message });
  }
};

// =========================================================================
// 4. CHỨC NĂNG: XÓA SHIPPER KHỎI HỆ THỐNG
// =========================================================================
exports.deleteshipper = async (req, res) => {
  try {
    const { id } = req.params; 

    const shipperBiXoa = await User.findByIdAndDelete(id);
    if (!shipperBiXoa) {
      return res.status(404).json({ success: false, message: "Không tìm thấy thông tin tài xế để xóa!" });
    }

    return res.status(200).json({ success: true, message: `Đã xóa hoàn toàn tài xế ${shipperBiXoa.full_name} khỏi hệ thống!` });

  } catch (error) {
    return res.status(500).json({ success: false, message: "Lỗi hệ thống không thể xóa tài xế!", error: error.message });
  }
};