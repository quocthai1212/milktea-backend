const express = require('express');
const router = express.Router();
const shipperOrderController = require('../../controllers/shipper/don_hang');

// =========================================================================
// 1. LINK LẤY DANH SÁCH ĐƠN HÀNG (Dùng cho cả đơn chờ và đơn đang đi giao)
// Gọi mẫu: GET /api/shipper/donhang?shipper_id=123456
// =========================================================================
router.get('/donhang', shipperOrderController.getshipper_donhang);

// =========================================================================
// 2. LINK TÀI XẾ BẤM LẤY ĐƠN VÀ BẮT ĐẦU ĐI GIAO (PREPARING -> SHIPPING)
// Gọi mẫu: PUT /api/shipper/donhang/nhan/6a181e38f...
// =========================================================================
router.put('/donhang/nhan/:id', shipperOrderController.nhan_donhang);

// =========================================================================
// 3. LINK TÀI XẾ XÁC NHẬN ĐÃ GIAO XONG XUẤT SẮC (SHIPPING -> COMPLETED)
// Gọi mẫu: PUT /api/shipper/donhang/hoanthanh/6a181e38f...
// =========================================================================
router.put('/donhang/hoanthanh/:id', shipperOrderController.hoan_thanh_donhang);

// =========================================================================
// 4. LINK TÀI XẾ BÁO CÁO GIAO THẤT BẠI / KHÁCH BOM (SHIPPING -> FAILED)
// Gọi mẫu: PUT /api/shipper/donhang/thatbai/6a181e38f...
// =========================================================================
router.put('/donhang/thatbai/:id', shipperOrderController.giao_that_bai_donhang);


module.exports = router;