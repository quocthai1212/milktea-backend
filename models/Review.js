const mongoose = require('mongoose');

const ReviewSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    order_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true }, 
    product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true }, // 👈 BẮT BUỘC PHẢI CÓ TRƯỜNG NÀY
    rating: { type: Number, required: true, min: 1, max: 5 }, // Nhận số thực 1.5, 2.5, 4.5... cực mượt
    comment_text: { type: String, trim: true, default: "" },
    review_images: [{ type: String }]
}, { timestamps: true });
  
// 🔥 SỬA LẠI CHỐNG SPAM: Mỗi khách hàng chỉ được đánh giá DUY NHẤT 1 lần cho CÙNG 1 SẢN PHẨM trong 1 ĐƠN HÀNG
ReviewSchema.index({ user_id: 1, order_id: 1, product_id: 1 }, { unique: true });

module.exports = mongoose.model('Review', ReviewSchema);