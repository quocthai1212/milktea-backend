const express = require('express');
const router = express.Router();

// 🎯 Đã đổi: Import file controller khuyến mãi bạn vừa tạo ở bước trước
const khuyenmaiController = require('../../controllers/quantri/khuyenmai');

// 🔍 Lấy danh sách tất cả mã khuyến mãi
router.get('/all', khuyenmaiController.layTatCaPromotions);

// ➕ Thêm mã khuyến mãi mới
router.post('/add', khuyenmaiController.taoMoiPromotion);

// ✏️ Chỉnh sửa thông tin mã khuyến mãi theo ID
router.put('/update/:id', khuyenmaiController.capNhatPromotion);

// 🗑️ Xóa mã khuyến mãi theo ID
router.delete('/delete/:id', khuyenmaiController.xoaPromotion);

module.exports = router;