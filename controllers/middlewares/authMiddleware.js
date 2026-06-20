const User = require('../../models/User'); // Đi lùi 2 nấc để tìm đến thư mục models chính thức

const authMiddleware = async (req, res, next) => {
  try {
    // 1. Lấy ID người dùng từ Header do Frontend gửi lên (Không dùng JWT)
    const userId = req.headers['x-user-id'];

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Không tìm thấy thông tin định danh người dùng. Vui lòng đăng nhập lại!'
      });
    }

    // 2. Truy vấn trực tiếp vào CSDL để lấy thông tin phân quyền và chi nhánh thực tế
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Tài khoản không tồn tại hoặc đã bị xóa khỏi hệ thống!'
      });
    }

    // 3. Đính thông tin quyền hạn và chi nhánh an toàn từ DB vào biến req.user
    req.user = {
      id: user._id,
      role_id: user.role_id,
      branch_id: user.branch_id
    };

    // 4. Cho phép request đi tiếp qua cửa gác để tới file controller load_danhsach
    next();

  } catch (error) {
    console.error('❌ Lỗi tại chốt chặn authMiddleware.js:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Hệ thống gặp sự cố khi xác thực tài khoản nhân viên!'
    });
  }
};

module.exports = authMiddleware;