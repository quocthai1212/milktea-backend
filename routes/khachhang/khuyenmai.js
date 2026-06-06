const express = require('express');
const router = express.Router();
// Import controller vừa tạo
const khuyenMaiController = require('../../controllers/khachhang/khuyenmai');

// Gọi đến hàm xử lý trong controller
router.get('/active', khuyenMaiController.getDanhSachKhuyenMaiActive);

module.exports = router;