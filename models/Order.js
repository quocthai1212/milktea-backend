const mongoose = require('mongoose');

// Schema phụ cho từng món trong đơn hàng
const OrderItemSchema = new mongoose.Schema({
  product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
  product_name: { type: String, required: true },
  base_price: { type: Number, required: true },
  quantity: { type: Number, required: true, min: 1 },
  selected_toppings: [{
    topping_name: { type: String },
    price: { type: Number }
  }],
  final_unit_price: { type: Number, required: true }, // = base_price + tổng price của selected_toppings
  subtotal: { type: Number, required: true } // = final_unit_price * quantity
});

// Schema phụ lưu lịch sử đổi trạng thái đơn hàng (để hủy đơn vẫn giữ lịch sử)
const StatusHistorySchema = new mongoose.Schema({
  status: { 
    type: String, 
    enum: ['pending', 'preparing', 'shipping', 'completed', 'failed', 'cancelled'] ,
    required: true 
  },
  updated_at: { type: Date, default: Date.now },
  reason: { type: String } // Lý do hủy (nếu có)
});

const OrderSchema = new mongoose.Schema({
  order_type: { type: String, enum: ['online', 'pos'], required: true }, // online: khách đặt, pos: tại quầy
  customer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  staff_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // Nhân viên xử lý hoặc tạo đơn
  shipper_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  items: [OrderItemSchema], // Danh sách các ly trà sữa đã đặt
  
  promotion_code: { type: mongoose.Schema.Types.ObjectId, ref: 'Promotion', default: null },
  discount_amount: { type: Number, default: 0 },
  products_subtotal: { type: Number, default: 0 }, // Tổng tiền hàng (chưa ship)
  shipping_fee: { type: Number, default: 0 },
  distance_km: { type: Number, default: 0 },
  total_amount: { type: Number, required: true }, // Số tiền cuối cùng phải trả
  
  payment_method: { type: String, enum: ['QR_CODE', 'CASH', 'PAYOS'], required: true },
  payment_status: {
    type: String,
    enum: ['UNPAID', 'PENDING', 'PAID', 'FAILED', 'CANCELLED'],
    default: 'UNPAID'
  },
  payos_order_code: { type: Number, default: null, index: true },
  payos_payment_link_id: { type: String, default: null, index: true },
  cash_details: {
    customer_cash: { type: Number, default: 0 }, // Tiền khách đưa
    change_due: { type: Number, default: 0 }     // Tiền thối lại cho khách
  },
  
  shipping_address: {
    address_detail: { type: String },
    customer_name: { type: String },
    phone: { type: String },
    latitude: { type: Number },
    longitude: { type: Number },
  },
  
  status: {
    type: String,
    enum: ['pending', 'preparing', 'shipping', 'completed', 'failed', 'cancelled'],
    default: 'pending'
  },
  cancel_reason: {
    type: String,
    default: null // Lưu lý do nếu rơi vào trạng thái 'failed' hoặc 'cancelled'
  },
  status_history: [StatusHistorySchema]
}, { timestamps: true });

module.exports = mongoose.model('Order', OrderSchema);
