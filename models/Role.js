const mongoose = require('mongoose');

const RoleSchema = new mongoose.Schema({
  _id: { type: Number, required: true }, // 1: admin, 2: staff, 3: customer
  role_name: { type: String, required: true, unique: true },
  description: { type: String }
});

module.exports = mongoose.model('Role', RoleSchema);