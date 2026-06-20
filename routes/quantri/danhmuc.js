const express = require('express');
const router = express.Router();
const danhMucController = require('../../controllers/quantri/danhmucsanpham');

// Đăng ký đường dẫn API
router.get('/all', danhMucController.getAllCategories);
router.post('/add', danhMucController.addCategory);
router.put('/update/:id', danhMucController.updateCategory);
router.delete('/delete/:id', danhMucController.deleteCategory);

module.exports = router;