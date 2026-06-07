const express = require('express');
const router = express.Router();

// ĐÃ CẬP NHẬT: Bóc tách đầy đủ cả 3 hàm xử lý từ file Controller sang
const { 
  loadDanhSachDonHang, 
  capNhatTrangThaiDonHang, 
  huyDonHangNhanVien 
} = require('../../controllers/nhanvien/load_danhsach');

/**
 * TẬP HỢP ENDPOINTS DÀNH CHO NHÂN VIÊN QUẦY
 * Tiền tố gốc cấu hình tại app.js: /api/nhanvien
 */

// 1. Tuyến đường lấy danh sách đơn hàng toàn hệ thống
// URL đầy đủ: GET http://localhost:5000/api/nhanvien/don-hang
router.get('/don-hang', loadDanhSachDonHang);

// 2. Tuyến đường cập nhật các trạng thái (Đang pha chế, Đang giao, Hoàn thành)
// URL đầy đủ: POST http://localhost:5000/api/nhanvien/don-hang/cap-nhat-trang-thai
router.post('/don-hang/cap-nhat-trang-thai', capNhatTrangThaiDonHang);

// 3. Tuyến đường hủy đơn hàng và ghi nhận lý do
// URL đầy đủ: POST http://localhost:5000/api/nhanvien/don-hang/huy
router.post('/don-hang/huy', huyDonHangNhanVien);

module.exports = router;