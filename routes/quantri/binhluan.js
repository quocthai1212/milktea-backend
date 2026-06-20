const express = require('express');
const router = express.Router();
const binhLuanController = require('../../controllers/quantri/binhluan');

// Quản lý danh sách bình luận
router.get('/all', binhLuanController.getDanhSachBinhLuan);
router.put('/lock/:userId', binhLuanController.khoaTaiKhoanUser);
router.delete('/delete/:id', binhLuanController.xoaBinhLuan);
router.put('/update/:id', binhLuanController.suaBinhLuan); // <--- THÊM ĐƯỜNG DẪN NÀY

// Quản lý từ khóa cấm gộp chung
router.get('/badwords/all', binhLuanController.getDanhSachTuCam);
router.post('/badwords/add', binhLuanController.themTuCam);
router.delete('/badwords/delete/:id', binhLuanController.xoaTuCam);

router.get('/sentiment-stats', binhLuanController.getThongKeCamXuc);
module.exports = router;