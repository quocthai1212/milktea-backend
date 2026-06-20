const mongoose = require('mongoose');

const ToppingSchema = new mongoose.Schema({
  topping_id: { type: String, required: true },
  topping_name: { type: String, required: true },
  price: { type: Number, required: true }
});

const SizeSchema = new mongoose.Schema({
  size_name: { type: String, required: true },
  extra_price: { type: Number, required: true }
});

const ProductSchema = new mongoose.Schema({
  product_name: { type: String, required: true },
  base_price: { type: Number, required: true },
  
  // 🌟 THAY ĐỔI: Tách biệt ảnh đại diện và ảnh giới thiệu
  avatar: { type: String },           // Lưu 1 ảnh đại diện duy nhất
  images: [{ type: String }],         // Lưu mảng nhiều ảnh giới thiệu/phụ
  
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  description: { type: String },
  is_active: { type: Boolean, default: true },
  toppings: [ToppingSchema],
  sizes: [SizeSchema]
}, { timestamps: true });

module.exports = mongoose.model('Product', ProductSchema);