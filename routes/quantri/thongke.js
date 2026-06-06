const express = require('express');
const router = express.Router();
const thongKeController = require('../../controllers/quantri/thongke');

// Cấu hình các đường dẫn endpoint API thống kê
router.get('/thongke/khachhang', thongKeController.thongKeTheoKhachHang);
router.get('/thongke/mathang', thongKeController.thongKeTheoMatHang);
router.get('/thongke/thoigian', thongKeController.thongKeTheoThoiGian);

module.exports = router;