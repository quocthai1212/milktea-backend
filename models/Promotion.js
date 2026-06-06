const mongoose = require('mongoose');

const PromotionSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  description: { type: String },
  discount_value: { type: Number, required: true },
  start_date: { type: Date, required: true },
  end_date: { type: Date, required: true },
  is_active: { type: Boolean, default: true },
  
  // ====== HAI TRƯỜNG QUẢN LÝ SỐ LƯỢNG ĐƯỢC BỔ SUNG KHÍT VỚI THỰC TẾ ======
  usage_limit: { type: Number, default: null }, // Tổng số lượt dùng tối đa (Ví dụ: 100 lượt). Nhập null nếu muốn chạy vô hạn.
  used_count: { type: Number, default: 0 }     // Số lượt đã sử dụng thực tế (Tăng lên 1 mỗi khi có khách áp mã thành công)
}, { timestamps: true });

module.exports = mongoose.model('Promotion', PromotionSchema);