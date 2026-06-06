const express = require('express');
const router = express.Router();

// Import file controller danh mục sản phẩm chứa các hàm CRUD
const categoryController = require('../../controllers/quantri/danhmucsanpham');

// 🔍 Lấy danh sách tất cả danh mục sản phẩm
router.get('/all', categoryController.getAllCategories);

// ➕ Thêm danh mục sản phẩm mới
router.post('/add', categoryController.createCategory);

// ✏️ Chỉnh sửa thông tin danh mục theo ID
router.put('/update/:id', categoryController.updateCategory);

// 🗑️ Xóa danh mục theo ID
router.delete('/delete/:id', categoryController.deleteCategory);

module.exports = router;