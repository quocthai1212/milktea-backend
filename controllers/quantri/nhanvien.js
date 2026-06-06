// Lưu ý: Thư mục hiện tại sâu hơn 1 cấp (nhanvien) nên phải đi ra bằng 3 dấu chấm (../../../models/User)
const User = require('../../models/User'); 
const bcrypt = require('bcryptjs');

// =========================================================================
// 1. CHỨC NĂNG: THÊM NHÂN VIÊN MỚI (Mặc định gán role_id = 2)
// =========================================================================
exports.getnhanvien = async (req, res) => {
    try {
      // Tìm tất cả người dùng có role_id là 2 (Nhân viên), sắp xếp người mới tạo lên đầu
      const danhSach = await User.find({ role_id: 2 }).sort({ createdAt: -1 });
      
      return res.status(200).json({
        success: true,
        data: danhSach
      });
    } catch (error) {
      return res.status(500).json({ 
        success: false, 
        message: "Lỗi hệ thống không thể lấy danh sách nhân viên!", 
        error: error.message 
      });
    }
  };
  
exports.adnhanvien = async (req, res) => {
  try {
    const { full_name, email, password, phone, cccd, birthday, gender, base_salary, is_active } = req.body;

    // Kiểm tra dữ liệu bắt buộc
    if (!full_name || !email || !password) {
      return res.status(400).json({ success: false, message: "Vui lòng nhập đầy đủ Họ tên, Email và Mật khẩu!" });
    }

    // Kiểm tra email trùng
    const emailDaTonTai = await User.findOne({ email: email.toLowerCase() });
    if (emailDaTonTai) {
      return res.status(400).json({ success: false, message: "Email này đã tồn tại trên hệ thống!" });
    }

    // Mã hóa mật khẩu bảo mật
    const saltRound = 10;
    const matKhauMaHoa = await bcrypt.hash(password, saltRound);

    const nhanVienMoi = new User({
      full_name,
      email: email.toLowerCase(),
      password: matKhauMaHoa,
      phone: phone || "",
      cccd: cccd || "",
      birthday: birthday || "",
      gender: gender || "Nam",
      role_id: 2, // 🎯 Tự động gán quyền Nhân viên
      base_salary: base_salary || 25000,
      is_active: is_active !== undefined ? is_active : true,
      shipping_addresses: [],
      attendance: []
    });

    await nhanVienMoi.save();
    return res.status(201).json({ success: true, message: `Đã thêm nhân viên ${full_name}!`, data: nhanVienMoi });

  } catch (error) {
    return res.status(500).json({ success: false, message: "Lỗi hệ thống không thể thêm nhân viên!", error: error.message });
  }
};

// =========================================================================
// 2. CHỨC NĂNG: CHỈNH SỬA THÔNG TIN NHÂN VIÊN (Dựa vào ID trên URL)
// =========================================================================
exports.updatenhanvien = async (req, res) => {
  try {
    const { id } = req.params; 
    const { full_name, email, phone, cccd, birthday, gender, base_salary, is_active, password } = req.body;

    const nhanVien = await User.findById(id);
    if (!nhanVien) {
      return res.status(404).json({ success: false, message: "Không tìm thấy nhân viên này!" });
    }

    // Kiểm tra trùng email mới nếu có thay đổi
    if (email && email.toLowerCase() !== nhanVien.email) {
      const emailTrung = await User.findOne({ email: email.toLowerCase() });
      if (emailTrung) {
        return res.status(400).json({ success: false, message: "Email mới này đã có người khác sử dụng!" });
      }
      nhanVien.email = email.toLowerCase();
    }

    // Cập nhật các trường thông tin
    if (full_name) nhanVien.full_name = full_name;
    if (phone !== undefined) nhanVien.phone = phone;
    if (cccd !== undefined) nhanVien.cccd = cccd;
    if (birthday !== undefined) nhanVien.birthday = birthday;
    if (gender) nhanVien.gender = gender;
    if (base_salary) nhanVien.base_salary = base_salary;
    if (is_active !== undefined) nhanVien.is_active = is_active;

    // Sửa mật khẩu nếu Admin nhập mật khẩu mới
    if (password && password.trim() !== "") {
      const saltRound = 10;
      nhanVien.password = await bcrypt.hash(password, saltRound);
    }

    await nhanVien.save();
    return res.status(200).json({ success: true, message: "Cập nhật thông tin nhân viên thành công!", data: nhanVien });

  } catch (error) {
    return res.status(500).json({ success: false, message: "Lỗi hệ thống không thể sửa nhân viên!", error: error.message });
  }
};

// =========================================================================
// 3. CHỨC NĂNG: XÓA NHÂN VIÊN KHỎI HỆ THỐNG
// =========================================================================
exports.deletenhanvien = async (req, res) => {
  try {
    const { id } = req.params; 

    const nhanVienBiXoa = await User.findByIdAndDelete(id);
    if (!nhanVienBiXoa) {
      return res.status(404).json({ success: false, message: "Không tìm thấy nhân viên để xóa!" });
    }

    return res.status(200).json({ success: true, message: `Đã xóa hoàn toàn nhân viên ${nhanVienBiXoa.full_name}!` });

  } catch (error) {
    return res.status(500).json({ success: false, message: "Lỗi hệ thống không thể xóa nhân viên!", error: error.message });
  }
};