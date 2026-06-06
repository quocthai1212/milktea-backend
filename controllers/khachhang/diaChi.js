const User = require('../../models/User');
const { xuLyDiaChiGiaoHang } = require('../../utils/xuLyDiaChi');

const xuLyCapNhatDiaChi = async (req, res) => {
  try {
    const { user_id, latitude, longitude, address_text } = req.body;

    if (!user_id) {
      return res.status(400).json({ message: 'Thiếu mã người dùng!' });
    }

    const user = await User.findById(user_id);
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy tài khoản!' });
    }

    if (Number(user.role_id) !== 3) {
      return res.status(403).json({ message: 'Chỉ khách hàng mới cập nhật địa chỉ giao hàng!' });
    }

    const ketQua = await xuLyDiaChiGiaoHang({ latitude, longitude, address_text });
    if (ketQua.error) {
      return res.status(400).json({ message: ketQua.error });
    }

    const diaChiMoi = {
      address_detail: ketQua.address_detail,
      district_id: ketQua.district_id,
      gps_location: ketQua.gps_location,
    };

    user.shipping_addresses = [diaChiMoi];
    await user.save();

    return res.status(200).json({
      message: 'Cập nhật địa chỉ giao hàng thành công!',
      shipping_address: diaChiMoi,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi cập nhật địa chỉ giao hàng!', error: error.message });
  }
};

module.exports = { xuLyCapNhatDiaChi };
