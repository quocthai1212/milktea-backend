const User = require('../models/User');
const bcrypt = require('bcryptjs');

const xuLyDangNhap = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Tìm tài khoản bằng Email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Đăng nhập không thành công! (Sai Email)' });
    }

    // 2. 🛡️ CHẶN ĐẦU CỬA: Nếu tài khoản đã bị khóa trước đó, đuổi ra ngay lập tức
    if (user.is_active === false) {
      return res.status(403).json({ 
        message: 'Tài khoản của bạn đã bị khóa do nhập sai mật khẩu quá 3 lần. Vui lòng liên hệ với người quản trị!' 
      });
    }

    // 3. So sánh mật khẩu khách nhập và mật khẩu mã hóa trong DB
    const isMatch = await bcrypt.compare(password, user.password);

    // ❌ TRƯỜNG HỢP: MẬT KHẨU KHÔNG CHÍNH XÁC (THẤT BẠI)
    if (!isMatch) {
      // Đảm bảo nếu trường đếm lỡ dính null thì tự gán thành 0 trước khi cộng
      if (user.login_attempts === null || isNaN(user.login_attempts)) {
        user.login_attempts = 0;
      }

      user.login_attempts += 1; // ➕ Cộng lên 1 lần sai

      // 🔒 Kiểm tra nếu đủ hoặc vượt quá 3 lần ➔ KHÓA TÀI KHOẢN
      if (user.login_attempts >= 3) {
        user.is_active = false; // Chuyển trạng thái sang BỊ KHÓA
        await user.save(); // Lưu lại thay đổi vào MongoDB

        return res.status(403).json({ 
          message: 'Tài khoản của bạn đã bị khóa do nhập sai mật khẩu 3 lần. Vui lòng liên hệ với người quản trị!' 
        });
      } 
      
      // Nếu chưa đủ 3 lần sai ➔ Chỉ lưu số lần đếm mới và cảnh báo người dùng
      else {
        await user.save();
        const soLanConLai = 3 - user.login_attempts;
        return res.status(400).json({ 
          message: `Đăng nhập không thành công! Bạn còn ${soLanConLai} lần thử trước khi tài khoản bị khóa.` 
        });
      }
    }

    // ✅ TRƯỜNG HỢP: ĐĂNG NHẬP THÀNH CÔNG
    // Đưa trường đếm về 0 sạch sẽ đề phòng trước đó họ từng gõ sai 1-2 lần
    user.login_attempts = 0;
    await user.save();

    // Lấy thông tin địa chỉ giao hàng cuối cùng (logic cũ của bạn)
    const diaChiGiaoHang = user.shipping_addresses?.length
      ? user.shipping_addresses[user.shipping_addresses.length - 1]
      : null;

    // Trả về dữ liệu đăng nhập thành công
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

// Đua hàm ra ngoài đúng tên để Router của bạn gọi trúng 100%
module.exports = { xuLyDangNhap };