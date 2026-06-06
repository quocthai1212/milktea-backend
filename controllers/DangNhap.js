const User = require('../models/User');
const bcrypt = require('bcryptjs');

const xuLyDangNhap = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Đăng nhập không thành công! (Sai Email)' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Đăng nhập không thành công! (Sai Mật khẩu)' });
    }

    const diaChiGiaoHang = user.shipping_addresses?.length
      ? user.shipping_addresses[user.shipping_addresses.length - 1]
      : null;

    return res.status(200).json({
      message: 'Đăng nhập thành công!',
      role_id: user.role_id,
      shipping_address: diaChiGiaoHang,
      user: {
        id: user._id,
        _id: user._id,
        full_name: user.full_name,
        email: user.email,
        role_id: user.role_id,
      },
    });

  } catch (error) {
    return res.status(500).json({ message: 'Lỗi máy chủ Đăng Nhập!', error: error.message });
  }
};

// ĐÂY LÀ CHỖ CHÍ MẠNG: Tên hàm xuất ra phải khớp 100% với file Router gọi tới
module.exports = { xuLyDangNhap };