const express = require('express');
const router = express.Router();
// Import trực tiếp hàm xử lý từ file Controller sang
const { xuLyTuVanAI } = require('../../controllers/khachhang/chatAI');
const { xuLyCapNhatDiaChi } = require('../../controllers/khachhang/diaChi');
const { layDonHangCuaKhach, huyDonHang, datDonHang, tinhPhiShip } = require('../../controllers/khachhang/donHang');
const { layHoSoKhach, capNhatHoSoKhach } = require('../../controllers/khachhang/hoSo');
const { taiDanhSachSanPhamTrangChu } = require('../../controllers/khachhang/trangchu_load');


router.post('/tu-van', xuLyTuVanAI);
router.post('/dia-chi-giao-hang', xuLyCapNhatDiaChi);
router.get('/don-hang', layDonHangCuaKhach);
router.get('/don-hang/phi-ship', tinhPhiShip);
router.post('/don-hang', datDonHang);
router.post('/don-hang/huy', huyDonHang);
router.get('/ho-so', layHoSoKhach);
router.put('/ho-so', capNhatHoSoKhach);
router.get('/sanpham', taiDanhSachSanPhamTrangChu);
module.exports = router;
