const User = require('../../models/User');
const bcrypt = require('bcryptjs');
const NodeGeocoder = require('node-geocoder');
const mongoose = require('mongoose');

const geocoder = NodeGeocoder({
  provider: 'openstreetmap'
});

const xuLyDangKy = async (req, res) => {
  try {
    // 1. Hứng đầy đủ các tham số (bổ sung address_text gửi từ ô sửa/nhập tay của Frontend)
    const { email, password, full_name, phone, latitude, longitude, address_text } = req.body;

    // Kiểm tra đầu vào bắt buộc từ Client
    if (!email || !password || !full_name) {
      return res.status(400).json({ message: 'Vui lòng nhập đầy đủ Email, Mật khẩu và Họ tên!' });
    }

    // 2. Kiểm tra trùng Email
    const emailTrung = await User.findOne({ email });
    if (emailTrung) {
      return res.status(400).json({ message: 'Email này đã được đăng ký trên hệ thống!' });
    }

    // Khởi tạo các biến lưu trữ vị trí cuối cùng
    let diaChiChuoiHoanChinh = '';
    let viDoCuoiCung = Number(latitude) || 0;
    let kinhDoCuoiCung = Number(longitude) || 0;

    // 3. LOGIC XỬ LÝ ĐỊA CHỈ & TỌA ĐỘ THÔNG MINH
    if (address_text && address_text.trim() !== '') {
      // TRƯỜNG HỢP A: Khách hàng tự gõ tay hoặc có chỉnh sửa ô chữ địa chỉ
      diaChiChuoiHoanChinh = address_text.trim();

      // Nếu khách gõ tay (Frontend truyền lat/lon lên = 0 hoặc thiếu), Backend tự động dịch chữ ra tọa độ số
      if (viDoCuoiCung === 0 || kinhDoCuoiCung === 0) {
        try {
          // Gửi chuỗi chữ lên vệ tinh OpenStreetMap để xin lại cặp tọa độ số thực tế
          const ketQuaTimKiem = await geocoder.geocode(diaChiChuoiHoanChinh);
          if (ketQuaTimKiem && ketQuaTimKiem.length > 0) {
            viDoCuoiCung = ketQuaTimKiem[0].latitude;
            kinhDoCuoiCung = ketQuaTimKiem[0].longitude;
          }
        } catch (geoErr) {
          console.error("Không thể tự động tìm tọa độ cho địa chỉ gõ tay:", geoErr.message);
          // Giữ nguyên tọa độ bằng 0 nếu hoàn toàn không tìm ra vùng đất đó
        }
      }
    } else {
      // TRƯỜNG HỢP B: Khách hoàn toàn tin tưởng vào GPS tự động (Không sửa chữ)
      if (viDoCuoiCung !== 0 && kinhDoCuoiCung !== 0) {
        try {
          const ketQuaDichNguoc = await geocoder.reverse({ lat: viDoCuoiCung, lon: kinhDoCuoiCung });
          if (ketQuaDichNguoc && ketQuaDichNguoc.length > 0) {
            diaChiChuoiHoanChinh = ketQuaDichNguoc[0].formattedAddress;
          } else {
            diaChiChuoiHoanChinh = `Vị trí định vị GPS (${viDoCuoiCung}, ${kinhDoCuoiCung})`;
          }
        } catch (err) {
          diaChiChuoiHoanChinh = `Vị trí định vị GPS (${viDoCuoiCung}, ${kinhDoCuoiCung})`;
        }
      } else {
        // Phòng hờ rớt vào case không gõ chữ mà cũng không bật định vị
        return res.status(400).json({ message: 'Vui lòng cung cấp địa chỉ nhận hàng bằng cách gõ tay hoặc định vị!' });
      }
    }

    // 4. GIẢI PHÁP VƯỢT QUA REQUIRED DISTRICT_ID (Giữ nguyên logic của bạn)
    let idVungGiaoHangHợpLệ = null;
    try {
      const vungGiaoHangMau = await mongoose.connection.db.collection('deliveryzones').findOne({});
      if (vungGiaoHangMau) {
        idVungGiaoHangHợpLệ = vungGiaoHangMau._id;
      } else {
        idVungGiaoHangHợpLệ = new mongoose.Types.ObjectId();
      }
    } catch (e) {
      idVungGiaoHangHợpLệ = new mongoose.Types.ObjectId();
    }

    // 5. Mã hóa mật khẩu bảo mật
    const hashedPassword = await bcrypt.hash(password, 10);

    // 6. Tiến hành tạo User theo đúng cấu trúc Schema
    await User.create({
      email: email,
      password: hashedPassword,
      full_name: full_name,
      phone: phone || '',
      role_id: 3, 
      is_active: true,   
      login_attempts: 0,
      is_vip: false,
      shipping_addresses: [
        {
          address_detail: diaChiChuoiHoanChinh, // Lưu chữ chuẩn (Do khách sửa hoặc GPS tìm)
          district_id: idVungGiaoHangHợpLệ,     
          gps_location: {
            latitude: viDoCuoiCung,             // Đã được tự động bù đắp từ địa chỉ chữ nếu khách gõ tay
            longitude: kinhDoCuoiCung           // Đã được tự động bù đắp từ địa chỉ chữ nếu khách gõ tay
          }
        }
      ],
      attendance: [] 
    });

    return res.status(201).json({
      message: 'Đăng ký tài khoản và đồng bộ vị trí thành công!'
    });

  } catch (error) {
    console.log("========================================");
    console.error("❌ LỖI TẠO USER:", error.message);
    console.log("========================================");
    return res.status(500).json({ message: 'Lỗi đồng bộ cấu trúc Schema!', error: error.message });
  }
};

module.exports = { xuLyDangKy };
