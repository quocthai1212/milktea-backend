const express = require('express');
const router = express.Router();
const khuyenMaiController = require('../../controllers/khachhang/khuyenmai');
const jwt = require('jsonwebtoken');

const CHU_BI_MAT = process.env.JWT_SECRET || 'secret';

// Chuẩn hóa id người dùng sau khi giải mã token (hỗ trợ cả id và _id)
const ganIdNguoiDung = (decoded) => {
  const userId = decoded.id || decoded._id;
  return {
    ...decoded,
    id: userId,
    _id: userId,
  };
};

const middlewareXacThuc = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: "Bạn chưa đăng nhập hoặc phiên làm việc hết hạn!" });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, CHU_BI_MAT);
    req.user = ganIdNguoiDung(decoded);
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: "Token không hợp lệ, vui lòng đăng nhập lại!" });
  }
};

// Tuỳ chọn: có token thì lấy id người dùng, không có vẫn cho xem trang khuyến mãi
const middlewareXacThucTuYChon = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, CHU_BI_MAT);
      req.user = ganIdNguoiDung(decoded);
    }
  } catch (error) {
    // Khách vãng lai hoặc token hết hạn: bỏ qua, vẫn cho xem danh sách voucher
  }
  next();
};

// --- HỆ THỐNG ROUTE ĐÃ ĐƯỢC LÀM SẠCH ---

// 1. Xem tất cả voucher (Khách chưa đăng nhập vẫn xem được, khách đăng nhập rồi thì check được nút "Đã lưu")
router.get('/all', middlewareXacThucTuYChon, khuyenMaiController.getAllPromotions);

// 2. Bấm nút nhận mã lưu vào ví (BẮT BUỘC đăng nhập)
router.post('/claim', middlewareXacThuc, khuyenMaiController.claimPromotion);

// 3. Lấy ví voucher lúc đặt hàng (BẮT BUỘC đăng nhập)
router.get('/checkout-vouchers', middlewareXacThuc, khuyenMaiController.getCheckoutVouchers);

module.exports = router;