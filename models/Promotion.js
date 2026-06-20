const mongoose = require('mongoose');

const PromotionSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  description: { type: String },
  discount_value: { type: Number, required: true },
  start_date: { type: Date, required: true },
  end_date: { type: Date, required: true },
  is_active: { type: Boolean, default: true },
  
  // 🌟 TRƯỜNG PHÂN LOẠI MÃ MỚI ĐƯỢC BỔ SUNG
  promotion_type: { 
    type: String, 
    enum: ['public', 'collectible'], 
    default: 'public' 
    // public: Ai cũng dùng được ngay không cần nhận
    // collectible: Phải bấm nhận vào ví mới được dùng
  },

  usage_limit: { type: Number, default: null }, // Tổng số lượt tối đa
  claimed_count: { type: Number, default: 0 },  // Lượt đã thu thập (Chỉ có nghĩa với loại collectible)
  used_count: { type: Number, default: 0 }     // Lượt đã sử dụng thực tế
}, { timestamps: true });

module.exports = mongoose.model('Promotion', PromotionSchema);