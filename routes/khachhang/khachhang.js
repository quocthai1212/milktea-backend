const express = require('express');
const router = express.Router();

// Import trực tiếp hàm xử lý từ file Controller sang
const chatAI = require('../../controllers/khachhang/chatAI');
const diaChi = require('../../controllers/khachhang/diaChi');
const donHang = require('../../controllers/khachhang/donHang');
const hoSo = require('../../controllers/khachhang/hoSo');
const trangChu = require('../../controllers/khachhang/trangchu_load');
const danhGia = require('../../controllers/khachhang/danhgia');

// Bẫy kiểm tra lỗi kiểm tra xem hàm nào bị import thiếu
const check = (fn, name) => {
    if (!fn) throw new Error(`Chưa export hoặc import sai tên hàm: "${name}"`);
    return fn;
};

// =========================================================================
// ⭐ CẤU HÌNH ROUTE ĐÁNH GIÁ & BÌNH LUẬN
// =========================================================================
router.post('/danh-gia', check(danhGia.createReview, 'createReview'));
router.get('/danh-gia/san-pham/:product_id', check(danhGia.getProductReviews, 'getProductReviews'));

// 🔥 ĐÃ ĐIỀU CHỈNH: Điều hướng qua hàm getOrders của file danhGia để lấy đơn hàng kèm Đánh giá hệ thập phân O(1)
router.get('/don-hang', check(danhGia.getOrders, 'getOrders'));

// =========================================================================
// 🛒 CẤU HÌNH ROUTE ĐƠN HÀNG VÀ VẬN CHUYỂN (File donHang)
// =========================================================================
router.get('/don-hang/phi-ship', check(donHang.tinhPhiShip, 'tinhPhiShip'));
router.post('/don-hang', check(donHang.datDonHang, 'datDonHang'));
router.post('/don-hang/huy', check(donHang.huyDonHang, 'huyDonHang'));


// =========================================================================
// 📝 CÁC ROUTE CHỨC NĂNG KHÁC
// =========================================================================
router.post('/tu-van', check(chatAI.xuLyTuVanAI, 'xuLyTuVanAI'));
router.post('/dia-chi-giao-hang', check(diaChi.xuLyCapNhatDiaChi, 'xuLyCapNhatDiaChi'));
router.get('/ho-so', check(hoSo.layHoSoKhach, 'layHoSoKhach'));
router.put('/ho-so', check(hoSo.capNhatHoSoKhach, 'capNhatHoSoKhach'));
router.get('/sanpham/goi-y', check(trangChu.getCustomerRecommendations, 'getCustomerRecommendations'));
router.get('/sanpham', check(trangChu.getTrangChuData, 'getTrangChuData'));
router.get('/sanpham/best-sellers', check(trangChu.getBestSellers, 'getBestSellers'));
router.get('/sanpham/recommendations/:customerId', check(trangChu.getCustomerRecommendations, 'getCustomerRecommendations'));
module.exports = router;
