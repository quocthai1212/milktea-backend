const mongoose = require('mongoose');

const CategorySchema = new mongoose.Schema({
  category_name: { type: String, required: true, unique: true, trim: true },
  description: { type: String, default: "" },
  folder_path: { type: String, default: "" },
  is_active: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Category', CategorySchema);