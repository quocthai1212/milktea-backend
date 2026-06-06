const mongoose = require('mongoose');

const DeliveryZoneSchema = new mongoose.Schema({
  city: { type: String, required: true },
  district: { type: String, required: true },
  is_available: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('DeliveryZone', DeliveryZoneSchema);