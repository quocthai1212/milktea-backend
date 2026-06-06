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
  payment_link_id: { type: String, default: null, index: true },
  checkout_url: { type: String, default: null },
  qr_code: { type: String, default: null },
  order_payload: { type: mongoose.Schema.Types.Mixed, default: null },
  raw_webhook_data: { type: mongoose.Schema.Types.Mixed, default: null },
  paid_at: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('Payment', PaymentSchema);
