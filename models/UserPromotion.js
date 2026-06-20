// models/UserPromotion.js
const mongoose = require('mongoose');

const UserPromotionSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // ID khách hàng
  promotion_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Promotion', required: true }, // ID mã giảm giá
  
  status: { 
    type: String, 
    enum: ['claimed', 'used', 'expired'], 
    default: 'claimed' 
    // claimed: Đã nhận vào ví (đang giữ chỗ, dùng sau)
    // used: Đã áp dụng thanh toán thành công
    // expired: Hết hạn sử dụng mà chưa xài
  },
  
  claimed_at: { type: Date, default: Date.now },
  used_at: { type: Date }
}, { timestamps: true });
// Thêm dòng này vào file models/UserPromotion.js trước module.exports
UserPromotionSchema.index({ user_id: 1, promotion_id: 1 }, { unique: true });

module.exports = mongoose.model('UserPromotion', UserPromotionSchema);