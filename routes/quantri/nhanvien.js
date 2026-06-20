const express = require('express');
const router = express.Router();

// Import file controller nhân viên thực tế của bạn
const nhanVienController = require('../../controllers/quantri/nhanvien'); 
// 💡 Lưu ý: Hãy chắc chắn đường dẫn 'require' ở trên trỏ đúng tới file controller nhân viên của bạn nhé!

// 🔍 Lấy danh sách tất cả nhân viên (Sửa từ getAllCategories -> getnhanvien)
router.get('/all', nhanVienController.getnhanvien);

// ➕ Thêm nhân viên mới (Sửa từ createCategory -> adnhanvien)
router.post('/add', nhanVienController.adnhanvien);

// ✏️ Chỉnh sửa thông tin nhân viên theo ID (Sửa từ updateCategory -> updatenhanvien)
router.put('/update/:id', nhanVienController.updatenhanvien);

// 🗑️ Xóa nhân viên theo ID (Sửa từ deleteCategory -> deletenhanvien)
router.delete('/delete/:id', nhanVienController.deletenhanvien);

router.get('/nhanvienchinhanh/all', nhanVienController.getChiNhanhAll);

module.exports = router;