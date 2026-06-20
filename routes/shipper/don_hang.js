const express = require('express');
const router = express.Router();
const shipperController = require('../../controllers/shipper/don_hang');

// 📥 Tuyến đường lấy danh sách đơn hàng (Frontend đang gọi fetch ở trên thành công)
router.get('/donhang', shipperController.getshipper_donhang);

// ⚡ Tuyến đường nhận đơn hàng (Cần thêm chính xác dòng này để sửa lỗi 404)
router.post('/donhang/nhan/:id', shipperController.nhan_donhang);

// ✔️ Tuyến đường giao thành công
router.post('/donhang/hoan-thanh/:id', shipperController.hoan_thanh_donhang);

// ❌ Tuyến đường báo giao thất bại
router.post('/donhang/that-bai/:id', shipperController.giao_that_bai_donhang);

module.exports = router;