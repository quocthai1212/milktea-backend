const express = require('express');
const router = express.Router();
const quenMKController = require('../../controllers/khachhang/QuenMK'); // Đảm bảo đường dẫn này trỏ chính xác tới file controller của bạn

// 1. Route gửi mã OTP về Email khách hàng
// Endpoint: POST http://localhost:5000/api/khachhang/quen-mat-khau/gui-otp
router.post('/gui-otp', quenMKController.guiMaOTP);

// 2. Route xác nhận mã OTP và tiến hành đổi mật khẩu mới
// Endpoint: POST http://localhost:5000/api/khachhang/quen-mat-khau/xac-nhan
router.post('/xac-nhan', quenMKController.xacNhanOTPVaDoiMK);

module.exports = router;