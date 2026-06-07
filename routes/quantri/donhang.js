const express = require('express');
const router = express.Router();

// Import file controller đơn hàng thực tế của bạn
const donHangController = require('../../controllers/quantri/donhang'); 
// 💡 Lưu ý: Hãy chắc chắn đường dẫn 'require' ở trên trỏ đúng tới file controller đơn hàng của bạn nhé!

// 🔍 Lấy và lọc danh sách tất cả đơn hàng (Hiển thị, lọc theo trạng thái/phương thức)
router.get('/all', donHangController.getDonHang);

// 👁️ Xem chi tiết một đơn hàng cụ thể theo ID (Bao gồm danh sách món uống, thông tin khách đặt)
router.get('/detail/:id', donHangController.getChiTietDonHang);

// ⚙️ Thay đổi trạng thái đơn hàng (Duyệt đơn, gán shipper, ép hoàn thành hoặc báo khách bom)
router.put('/update-status/:id', donHangController.updateTrangThaiDonHang);

// 🖨️ Xử lý/Lấy dữ liệu phục vụ việc in hóa đơn nhanh
router.get('/print/:id', donHangController.getDuLieuInDonHang);

module.exports = router;