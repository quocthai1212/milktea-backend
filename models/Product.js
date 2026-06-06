const mongoose = require('mongoose');

// Schema phụ cho Topping đi kèm của từng món ăn/nước uống
const ToppingSchema = new mongoose.Schema({
  topping_id: { type: String, required: true },
  topping_name: { type: String, required: true },
  price: { type: Number, required: true } // Giá riêng của từng loại topping
});

// ➕ Schema phụ mới cho Kích thước (Size) của ly nước
const SizeSchema = new mongoose.Schema({
  size_name: { type: String, required: true },  // Tên kích thước (VD: "Size M", "Size L", "Ly 700ml")
  extra_price: { type: Number, required: true } // Giá tiền (Có thể là giá cộng thêm hoặc giá đứt của size đó, VD: 0, 5000)
});

const ProductSchema = new mongoose.Schema({
  product_name: { type: String, required: true },
  base_price: { type: Number, required: true }, // Giá gốc của ly trà sữa chưa có topping
  image: { type: String },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  description: { type: String },
  is_active: { type: Boolean, default: true }, // Admin/Nhân viên ẩn/hiện sản phẩm
  
  toppings: [ToppingSchema], // Nhúng danh sách topping khách có thể chọn vào ly trà sữa này
  
  // ➕ Nhúng danh sách kích thước ly mà món nước này hỗ trợ
  sizes: [SizeSchema]        // Lưu mảng danh sách [{ size_name, extra_price }] gửi từ Frontend
}, { timestamps: true });

module.exports = mongoose.model('Product', ProductSchema);