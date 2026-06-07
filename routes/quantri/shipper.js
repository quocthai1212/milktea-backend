const express = require('express');
const router = express.Router();

// 💡 Đảm bảo đường dẫn require này trỏ đúng đến file controller shipper của bạn
const shipperController = require('../../controllers/quantri/shipper');

// 🔍 Lấy danh sách tất cả shipper (Sửa tên hàm thành getshipper)
router.get('/all', shipperController.getshipper);

// ➕ Thêm shipper mới (Sửa tên hàm thành adshipper)
router.post('/add', shipperController.adshipper);

// ✏️ Chỉnh sửa thông tin shipper theo ID (Sửa tên hàm thành updateshipper)
router.put('/update/:id', shipperController.updateshipper);

// 🗑️ Xóa shipper theo ID (Sửa tên hàm thành deleteshipper)
router.delete('/delete/:id', shipperController.deleteshipper);

module.exports = router;