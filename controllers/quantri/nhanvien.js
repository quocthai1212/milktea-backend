const User = require('../../models/User'); 
const ShippingConfig = require('../../models/ShippingConfig'); 
const bcrypt = require('bcryptjs');

// =========================================================================
// 1. CHỨC NĂNG: LẤY DANH SÁCH (GỒM CẢ NHÂN VIÊN ROLE 2 VÀ SHIPPER ROLE 4)
// =========================================================================
exports.getnhanvien = async (req, res) => {
  try {
    // Dùng toán tử $in để quét sạch cả tài khoản có role_id là 2 và 4
    // .populate('branch_id') để lấy kèm thông tin chi tiết tên và địa chỉ của chi nhánh quản lý
    const danhSach = await User.find({ role_id: { $in: [2, 4] } })
      .populate('branch_id', 'branch_name shop_address') 
      .sort({ createdAt: -1 });
    
    return res.status(200).json({
      success: true,
      data: danhSach
    });
  } catch (error) {
    return res.status(500).json({ 
      success: false, 
      message: "Lỗi hệ thống không thể lấy danh sách nhân sự!", 
      error: error.message 
    });
  }
};
  
// =========================================================================
// 2. CHỨC NĂNG: THÊM NHÂN SỰ MỚI (ĐÃ CẬP NHẬT BỎ USERNAME)
// =========================================================================
exports.adnhanvien = async (req, res) => {
  try {
    const { full_name, email, password, phone, cccd, birthday, gender, base_salary, is_active, role_id, branch_id } = req.body;

    // Kiểm tra dữ liệu bắt buộc
    if (!full_name || !email || !password) {
      return res.status(400).json({ success: false, message: "Vui lòng nhập đầy đủ Họ tên, Email và Mật khẩu!" });
    }

    const emailChuan = email.trim().toLowerCase();

    // Kiểm tra email trùng
    const emailDaTonTai = await User.findOne({ email: emailChuan });
    if (emailDaTonTai) {
      return res.status(400).json({ success: false, message: "Email này đã tồn tại trên hệ thống!" });
    }

    if (phone && phone.trim() !== "") {
      const sdtDaTonTai = await User.findOne({ phone: phone.trim() });
      if (sdtDaTonTai) {
        return res.status(400).json({ success: false, message: "Số điện thoại này đã được đăng ký bởi tài khoản khác!" });
      }
    }

    // Mã hóa mật khẩu bảo mật
    const saltRound = 10;
    const matKhauMaHoa = await bcrypt.hash(password, saltRound);

    // 💡 GIẢI PHÁP PHÒNG NGỪA: Nếu Schema DB vẫn yêu cầu 'username' và có thuộc tính 'unique'
    // Hệ thống tự động cắt chuỗi Email trước chữ '@' làm username tạm thời để tránh lỗi trùng chuỗi rỗng ""
    const usernameTuDong = emailChuan.split('@')[0] + '_' + Math.floor(1000 + Math.random() * 9000);

    const nhanVienMoi = new User({
      username: usernameTuDong, // Thêm tự động để không lỗi DB Schema cũ
      full_name: full_name.trim(),
      email: emailChuan,
      password: matKhauMaHoa,
      phone: phone ? phone.trim() : "",
      cccd: cccd ? cccd.trim() : "",
      birthday: birthday || "",
      gender: gender || "Nam",
      role_id: role_id ? Number(role_id) : 2, 
      base_salary: base_salary || 25000,
      is_active: is_active !== undefined ? is_active : true,
      branch_id: branch_id && branch_id !== "" ? branch_id : null, 
      shipping_addresses: [],
      attendance: []
    });

    await nhanVienMoi.save();
    
    return res.status(201).json({ 
      success: true, 
      message: `Thêm nhân sự mới thành công!`, 
      data: nhanVienMoi 
    });

  } catch (error) {
    return res.status(500).json({ success: false, message: "Lỗi hệ thống không thể thêm nhân sự!", error: error.message });
  }
};

// =========================================================================
// 3. CHỨC NĂNG: CHỈNH SỬA THÔNG TIN & THAY ĐỔI QUYỀN HẠN / CHI NHÁNH
// =========================================================================
exports.updatenhanvien = async (req, res) => {
  try {
    const { id } = req.params; 
    const { full_name, email, phone, cccd, birthday, gender, base_salary, is_active, password, role_id, branch_id } = req.body;

    const nhanVien = await User.findById(id);
    if (!nhanVien) {
      return res.status(404).json({ success: false, message: "Không tìm thấy thông tin nhân sự này!" });
    }

    // Kiểm tra trùng email mới nếu có thay đổi từ phía client
    if (email && email.trim().toLowerCase() !== nhanVien.email) {
      const emailChuan = email.trim().toLowerCase();
      const emailTrung = await User.findOne({ email: emailChuan });
      if (emailTrung) {
        return res.status(400).json({ success: false, message: "Email mới này đã có người khác sử dụng!" });
      }
      nhanVien.email = emailChuan;
      
      // Cập nhật luôn username theo email mới nếu DB yêu cầu đồng bộ
      nhanVien.username = emailChuan.split('@')[0] + '_' + Math.floor(1000 + Math.random() * 9000);
    }

    // Kiểm tra trùng số điện thoại
    if (phone && phone.trim() !== "") {
      const sdtDaTonTai = await User.findOne({ 
        phone: phone.trim(), 
        _id: { $ne: id } // Tìm số điện thoại này nhưng phải KHÁC ID đang sửa
      });
      if (sdtDaTonTai) {
        return res.status(400).json({ success: false, message: "Số điện thoại này đã thuộc về tài khoản khác!" });
      }
    }
    
    // Cập nhật các trường thông tin cơ bản
    if (full_name) nhanVien.full_name = full_name.trim();
    if (phone !== undefined) nhanVien.phone = phone.trim();
    if (cccd !== undefined) nhanVien.cccd = cccd.trim();
    if (birthday !== undefined) nhanVien.birthday = birthday;
    if (gender) nhanVien.gender = gender;
    if (base_salary) nhanVien.base_salary = base_salary;
    if (is_active !== undefined) nhanVien.is_active = is_active;
    if (role_id !== undefined) nhanVien.role_id = Number(role_id);
    
    // Cho phép thay đổi điều chuyển chi nhánh trực thuộc hoặc chuyển về null (Tự do)
    if (branch_id !== undefined) {
      nhanVien.branch_id = branch_id && branch_id !== "" ? branch_id : null;
    }

    // Sửa mật khẩu nếu Admin nhập mật khẩu mới
    if (password && password.trim() !== "") {
      const saltRound = 10;
      nhanVien.password = await bcrypt.hash(password, saltRound);
    }

    await nhanVien.save();
    return res.status(200).json({ success: true, message: "Cập nhật dữ liệu nhân sự thành công!", data: nhanVien });

  } catch (error) {
    return res.status(500).json({ success: false, message: "Lỗi hệ thống không thể sửa thông tin nhân sự!", error: error.message });
  }
};

// =========================================================================
// 4. CHỨC NĂNG: XÓA NHÂN SỰ KHỎI HỆ THỐNG
// =========================================================================
exports.deletenhanvien = async (req, res) => {
  try {
    const { id } = req.params; 

    const nhanVienBiXoa = await User.findByIdAndDelete(id);
    if (!nhanVienBiXoa) {
      return res.status(404).json({ success: false, message: "Không tìm thấy đối tượng cần xóa!" });
    }

    return res.status(200).json({ success: true, message: `Đã xóa hoàn toàn dữ liệu của tài khoản ${nhanVienBiXoa.full_name}!` });

  } catch (error) {
    return res.status(500).json({ success: false, message: "Lỗi hệ thống không thể thực hiện lệnh xóa!", error: error.message });
  }
};

// =========================================================================
// 5. LẤY TOÀN BỘ DANH SÁCH CHI NHÁNH ĐỂ PHỤC VỤ Ô CHỌN
// =========================================================================
exports.getChiNhanhAll = async (req, res) => {
  try {
    // Chỉ lấy ra các chi nhánh đang mở cửa hoạt động (is_active: true)
    const danhSachChiNhanh = await ShippingConfig.find({ is_active: true }).sort({ branch_name: 1 });
    
    return res.status(200).json({
      success: true,
      data: danhSachChiNhanh
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống không thể quét danh sách chi nhánh!",
      error: error.message
    });
  }
};