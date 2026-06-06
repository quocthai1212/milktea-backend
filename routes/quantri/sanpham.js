const express = require('express');
const router = express.Router();

// Import file controller chứa 3 hàm bạn vừa đổi tên
const sanphamController = require('../../controllers/quantri/sanpham');

router.get('/all', sanphamController.getsanpham);
// ➕ Thêm nhân viên mới
router.post('/add', sanphamController.addsanpham);

// ✏️ Chỉnh sửa thông tin nhân viên
router.put('/update/:id', sanphamController.updatesanpham);

// 🗑️ Xóa nhân viên
router.delete('/delete/:id', sanphamController.deletesanpham);

module.exports = router;