const express = require('express');
const router = express.Router();
const khuyenMaiController = require('../../controllers/khachhang/khuyenmai');

// --- HỆ THỐNG ROUTE KHÔNG DÙNG AUTH TOKEN ---

// 1. Xem tất cả voucher
router.get('/all', khuyenMaiController.getAllPromotions);

// 2. Bấm nút nhận mã lưu vào ví 
router.post('/claim', khuyenMaiController.claimPromotion);

// 3. Lấy ví voucher lúc đặt hàng (CHỈ TRUYỀN ID TRỰC TIẾP)
// 💡 ĐÃ BỎ middlewareXacThuc ở đây
router.get('/checkout-vouchers', khuyenMaiController.getCheckoutVouchers);

module.exports = router;