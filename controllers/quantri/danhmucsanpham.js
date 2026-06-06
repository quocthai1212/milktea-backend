const Category = require('../../models/Category'); // Đảm bảo đường dẫn này trỏ đúng đến file Category Schema của bạn

// 1. LẤY DANH SÁCH TẤT CẢ DANH MỤC
// Tương ứng Route: router.get('/all', categoryController.getAllCategories);
exports.getAllCategories = async (req, res) => {
    try {
        // Lấy tất cả danh mục trong database, sắp xếp theo thời gian tạo mới nhất
        const categories = await Category.find().sort({ createdAt: -1 });
        
        return res.status(200).json({
            success: true,
            data: categories
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Lỗi hệ thống khi lấy danh sách danh mục!",
            error: error.message
        });
    }
};

// 2. THÊM MỚI DANH MỤC
// Tương ứng Route: router.post('/add', categoryController.createCategory);
exports.createCategory = async (req, res) => {
    try {
        const { category_name, description, is_active } = req.body;

        // Kiểm tra dữ liệu bắt buộc không được trống
        if (!category_name || category_name.trim() === "") {
            return res.status(400).json({
                success: false,
                message: "Tên danh mục không được để trống!"
            });
        }

        // Kiểm tra trùng tên danh mục trong cơ sở dữ liệu (không phân biệt chữ hoa / chữ thường)
        const existingCategory = await Category.findOne({ 
            category_name: { $regex: new RegExp(`^${category_name.trim()}$`, 'i') } 
        });
        if (existingCategory) {
            return res.status(400).json({
                success: false,
                message: "Tên danh mục này đã tồn tại, vui lòng chọn tên khác!"
            });
        }

        // Khởi tạo đối tượng dựa trên Schema
        const newCategory = new Category({
            category_name: category_name.trim(),
            description: description || "",
            is_active: is_active !== undefined ? is_active : true
        });

        // Tiến hành lưu vào MongoDB
        await newCategory.save();

        return res.status(201).json({
            success: true,
            message: "Thêm danh mục mới thành công!",
            data: newCategory
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Lỗi hệ thống khi tạo danh mục!",
            error: error.message
        });
    }
};

// 3. CHỈNH SỬA THÔNG TIN DANH MỤC
// Tương ứng Route: router.put('/update/:id', categoryController.updateCategory);
exports.updateCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { category_name, description, is_active } = req.body;

        // 1. Kiểm tra xem danh mục cần chỉnh sửa có tồn tại không
        const category = await Category.findById(id);
        if (!category) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy danh mục yêu cầu chỉnh sửa!"
            });
        }

        // 2. Nếu người dùng thay đổi tên, kiểm tra xem tên mới có trùng danh mục khác không
        if (category_name && category_name.trim() !== category.category_name) {
            const existingCategory = await Category.findOne({
                _id: { $ne: id }, // Loại trừ ID hiện tại đang sửa ra
                category_name: { $regex: new RegExp(`^${category_name.trim()}$`, 'i') }
            });
            if (existingCategory) {
                return res.status(400).json({
                    success: false,
                    message: "Tên danh mục mới đã bị trùng với một danh mục khác có sẵn!"
                });
            }
        }

        // 3. Tiến hành cập nhật trực tiếp dữ liệu mới vào MongoDB
        const updatedCategory = await Category.findByIdAndUpdate(
            id,
            {
                category_name: category_name ? category_name.trim() : category.category_name,
                description: description !== undefined ? description : category.description,
                is_active: is_active !== undefined ? is_active : category.is_active
            },
            { new: true, runValidators: true } // Trả về đối tượng sau khi đã update xong và kích hoạt validate dữ liệu
        );

        return res.status(200).json({
            success: true,
            message: "Cập nhật thông tin danh mục thành công!",
            data: updatedCategory
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Lỗi hệ thống khi cập nhật danh mục!",
            error: error.message
        });
    }
};

// 4. XÓA DANH MỤC KHỎI HỆ THỐNG
// Tương ứng Route: router.delete('/delete/:id', categoryController.deleteCategory);
exports.deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;

        // Thực hiện tìm và xóa phần tử khỏi MongoDB
        const deletedCategory = await Category.findByIdAndDelete(id);

        if (!deletedCategory) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy danh mục để thực hiện thao tác xóa!"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Đã xóa danh mục sản phẩm thành công khỏi hệ thống!"
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Lỗi hệ thống khi xóa danh mục!",
            error: error.message
        });
    }
};