const mongoose = require('mongoose');

const AIChatLogSchema = new mongoose.Schema({
  customer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  session_id: { type: String, required: true }, // Định danh phiên chat kể cả khi khách chưa login
  messages: [{
    sender: { type: String, enum: ['customer', 'ai'], required: true },
    text: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

module.exports = mongoose.model('AIChatLog', AIChatLogSchema);