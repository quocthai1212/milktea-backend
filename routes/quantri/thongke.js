const express = require('express');
const router = express.Router();
// Import chuẩn xác đến file controller chứa 3 hàm thống kê tối ưu ở bước trước
const thongKeController = require('../../controllers/quantri/thongke');

// Khai báo định tuyến tương thích chuẩn xác với các lượt gọi từ Frontend của bạn
router.get('/khachhang', thongKeController.thongKeTheoKhachHang);
router.get('/mathang', thongKeController.thongKeTheoMatHang);
router.get('/thoigian', thongKeController.thongKeTheoThoiGian);
router.get('/chitiet', thongKeController.getChiTietThongKe);
module.exports = router;