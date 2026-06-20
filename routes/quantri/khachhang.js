const express = require('express');
const router = express.Router();
const khachHangController = require('../../controllers/quantri/khachhang');

// Khai báo đường dẫn API quản lý
router.get('/all', khachHangController.getKhachHang);                      // Lấy danh sách
router.post('/add', khachHangController.addKhachHang);                     // Thêm mới
router.put('/update/:id', khachHangController.updateKhachHang);            // Chỉnh sửa thông tin
router.delete('/delete/:id', khachHangController.deleteKhachHang);         // Xóa hẳn

module.exports = router;