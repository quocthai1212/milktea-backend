const express = require('express');
const router = express.Router();

// Chỉ import duy nhất file Controller Đăng Nhập
const DangNhapController = require('../controllers/DangNhap'); 

// Gọi chính xác hàm xử lý đăng nhập
router.post('/dangnhap', DangNhapController.xuLyDangNhap);

module.exports = router;