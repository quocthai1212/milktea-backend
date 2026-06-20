const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema({
  order_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null, index: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  order_code: { type: Number, required: true, unique: true, index: true },
  method: { type: String, enum: ['PAYOS'], required: true, default: 'PAYOS' },
  amount: { type: Number, required: true },
  status: {
    type: String,
    enum: ['PENDING', 'PAID', 'FAILED', 'CANCELLED'],
    default: 'PENDING',
    index: true,
  },

  // 🔴 CÁC TRƯỜNG CẬP NHẬT THÊM ĐỂ LƯU THÔNG TIN CHUYỂN KHOẢN THỰC TẾ
  bank_account_name: { type: String, default: null }, // Tên chủ tài khoản người chuyển
  bank_account_number: { type: String, default: null }, // 🌟 THÊM MỚI: Số tài khoản người chuyển (Ví dụ: 1903xxxx)
  bank_description: { type: String, default: null },  // Nội dung chuyển khoản thực tế hiển thị trên sao kê
  bank_amount_paid: { type: Number, default: 0 },     // Số tiền thực tế ngân hàng ghi nhận được
  bank_reference: { type: String, default: null },    // Mã tham chiếu/Mã giao dịch ngân hàng

  payment_link_id: { type: String, default: null, index: true },
  checkout_url: { type: String, default: null },
  qr_code: { type: String, default: null },
  order_payload: { type: mongoose.Schema.Types.Mixed, default: null },
  raw_webhook_data: { type: mongoose.Schema.Types.Mixed, default: null },
  paid_at: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('Payment', PaymentSchema);