const User = require('../../models/User');
const { xuLyDiaChiGiaoHang } = require('../../utils/xuLyDiaChi');

const layHoSoKhach = async (req, res) => {
  try {
    const { user_id } = req.query;
    if (!user_id) {
      return res.status(400).json({ message: 'Thiếu mã khách hàng!' });
    }

    const user = await User.findById(user_id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy tài khoản!' });
    }

    if (Number(user.role_id) !== 3) {
      return res.status(403).json({ message: 'Chỉ áp dụng cho tài khoản khách hàng!' });
    }

    const shipping_address = user.shipping_addresses?.length
      ? user.shipping_addresses[user.shipping_addresses.length - 1]
      : null;

    return res.status(200).json({
      user: {
        id: user._id,
        email: user.email,
        full_name: user.full_name,
        phone: user.phone || '',
        is_vip: user.is_vip,
      },
      shipping_address,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi tải hồ sơ!', error: error.message });
  }
};

const capNhatHoSoKhach = async (req, res) => {
  try {
    const { user_id, full_name, phone, latitude, longitude, address_text } = req.body;

    if (!user_id) {
      return res.status(400).json({ message: 'Thiếu mã khách hàng!' });
    }

    const user = await User.findById(user_id);
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy tài khoản!' });
    }

    if (Number(user.role_id) !== 3) {
      return res.status(403).json({ message: 'Chỉ áp dụng cho tài khoản khách hàng!' });
    }

    if (full_name?.trim()) user.full_name = full_name.trim();
    if (phone !== undefined) user.phone = phone?.trim() || '';

    let shipping_address = user.shipping_addresses?.[0] || null;

    if (address_text !== undefined && address_text !== null && String(address_text).trim() !== '') {
      const ketQua = await xuLyDiaChiGiaoHang({ latitude, longitude, address_text });
      if (ketQua.error) {
        return res.status(400).json({ message: ketQua.error });
      }
      shipping_address = {
        address_detail: ketQua.address_detail,
        district_id: ketQua.district_id,
        gps_location: ketQua.gps_location,
      };
      user.shipping_addresses = [shipping_address];
    }

    await user.save();

    return res.status(200).json({
      message: 'Cập nhật thông tin thành công!',
      user: {
        id: user._id,
        email: user.email,
        full_name: user.full_name,
        phone: user.phone || '',
        is_vip: user.is_vip,
      },
      shipping_address: user.shipping_addresses?.[0] || shipping_address,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi cập nhật hồ sơ!', error: error.message });
  }
};

module.exports = { layHoSoKhach, capNhatHoSoKhach };
