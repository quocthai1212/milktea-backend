const express = require('express');
const router = express.Router();

// 🛡️ Middleware kiểm tra X-User-Id từ CSDL (Chốt gác cổng an toàn)
const authMiddleware = require('../../controllers/middlewares/authMiddleware'); 

// 🎯 Import các hàm xử lý từ Controller nghiệp vụ nhân viên
const { 
  loadDanhSachDonHangChiNhanh, 
  capNhatTrangThaiDonHang 
} = require('../../controllers/nhanvien/load_danhsach');

/**
 * ==========================================
 * QUẢN LÝ TIẾN TRÌNH ĐƠN HÀNG TRỰC TUYẾN (NHÂN VIÊN)
 * ==========================================
 */

// 1. [GET ALL] - Tải toàn bộ danh sách đơn hàng thuộc chi nhánh (hoặc toàn hệ thống đối với Admin)
router.get('/don-hang', authMiddleware, loadDanhSachDonHangChiNhanh);

// 2. [UPDATE] - Cập nhật trạng thái tiến trình đơn (preparing, ready, cancelled...)
router.post('/don-hang/update', authMiddleware, capNhatTrangThaiDonHang);

module.exports = router;