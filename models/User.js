const mongoose = require('mongoose');

// Schema phụ cho Địa chỉ khách hàng (ĐÃ TỐI ƯU ĐỂ CHẠY GPS TỰ ĐỘNG)
const ShippingAddressSchema = new mongoose.Schema({
  address_detail: { type: String, required: true },
  district_id: { type: mongoose.Schema.Types.Mixed, default: null },
  gps_location: {
    latitude: { type: Number, default: 0 },  // Vĩ độ
    longitude: { type: Number, default: 0 }  // Kinh độ
  }
});

const UserSchema = new mongoose.Schema({
  // --- 📝 THÔNG TIN CHUNG (Ai cũng phải có để Đăng nhập & Định danh) ---
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  full_name: { type: String, required: true },
  phone: { type: String },
  // 🎯 BỔ SUNG THÊM ĐỂ QUẢN LÝ NHÂN VIÊN CHUYÊN NGHIỆP:
  cccd: { type: String, default: "" },       // Số Căn cước công dân
  birthday: { type: String, default: "" },   // Ngày sinh (Lưu chuỗi "YYYY-MM-DD")
  gender: { type: String, enum: ['Nam', 'Nữ', 'Khác'], default: 'Nam' }, // Giới tính
  role_id: { type: Number, ref: 'Role', required: true }, // 1: Admin, 2: Nhân viên, 3: Khách hàng
  
  // --- 🔒 TRẠNG THÁI TÀI KHOẢN (Áp dụng cho cả Khách và Nhân viên) ---
  is_active: { type: Boolean, default: true }, // 👈 THÊM MỚI: true = bình thường, false = bị khóa (nhân viên nghỉ việc / khách vi phạm)

  // --- 💰 CẤU HÌNH LƯƠNG NHÂN VIÊN ---
  base_salary: { type: Number, default: 25000 }, // 👈 THÊM MỚI: Mức lương theo giờ (Khách hàng thì mặc định bỏ qua không dùng trường này)

  // --- 🛒 ĐẶC QUYỀN KHÁCH HÀNG ---
  is_vip: { type: Boolean, default: false }, 
  
  // --- 🗄️ CÁC MẢNG LƯU TRỮ LỊCH SỬ (Dữ liệu động) ---
  shipping_addresses: [ShippingAddressSchema], // Khách hàng mua trà sữa sẽ đẩy địa chỉ vào đây
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);