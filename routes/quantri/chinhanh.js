const express = require('express');
const router = express.Router();
const chiNhanhController = require('../../controllers/quantri/chinhanh');

router.get('/all', chiNhanhController.getDanhSachChiNhanh);
router.post('/add', chiNhanhController.themMoiChiNhanh);
router.put('/update/:id', chiNhanhController.capNhatChiNhanh);
router.delete('/delete/:id', chiNhanhController.xoaChiNhanh);
router.get('/all-orders', chiNhanhController.getChiNhanhChoKhachHang);
module.exports = router;