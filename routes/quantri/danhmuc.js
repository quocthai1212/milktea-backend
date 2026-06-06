const express = require('express');
const router = express.Router();
const categoryController = require('../../controllers/quantri/danhmucsanpham');

// SỬA LẠI ĐƯỜNG DẪN Ở ĐÂY ĐỂ KHỚP VỚI FRONTEND:
router.get('/all', categoryController.getAllCategories);          // Tạo thành: /api/quantri/danhmuc/all
router.post('/add', categoryController.createCategory);          // Tạo thành: /api/quantri/danhmuc/add
router.put('/update/:id', categoryController.updateCategory);    // Tạo thành: /api/quantri/danhmuc/update/:id
router.delete('/delete/:id', categoryController.deleteCategory); // Tạo thành: /api/quantri/danhmuc/delete/:id

module.exports = router;