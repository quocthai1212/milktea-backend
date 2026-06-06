var express = require('express');
var router = express.Router();
const DangKyController = require('../../controllers/khachhang/DangKy'); 
const NodeGeocoder = require('node-geocoder');

// Cấu hình thư viện dịch tọa độ miễn phí
const geocoder = NodeGeocoder({ provider: 'openstreetmap' });

/* 1. API Đăng ký tài khoản (Đã có sẵn của bạn) */
router.post('/dangky', DangKyController.xuLyDangKy);

/* 2. API DỊCH TỌA ĐỘ SANG CHỮ ĐỊA CHỈ (Đảm bảo phải có đoạn này) */
router.get('/dich-toa-do', async (req, res) => {
  try {
    const { lat, lon } = req.query;
    
    if (!lat || !lon) {
      return res.status(400).json({ message: 'Thiếu tọa độ vĩ độ (lat) hoặc kinh độ (lon)!' });
    }

    // Tiến hành gọi vệ tinh dịch ngược tọa độ sang chữ địa chỉ tiếng Việt
    const ketQua = await geocoder.reverse({ lat: parseFloat(lat), lon: parseFloat(lon) });
    
    if (ketQua && ketQua.length > 0) {
      // Trả về địa chỉ chuỗi hoàn chỉnh cho Frontend
      return res.status(200).json({ address: ketQua[0].formattedAddress });
    } else {
      return res.status(404).json({ address: `Tọa độ: ${lat}, ${lon}` });
    }
  } catch (error) {
    console.error("Lỗi Geocoder tại Server:", error.message);
    // Nếu có lỗi mạng hoặc quá tải, trả về chính tọa độ để giao diện không bị sập
    return res.status(200).json({ address: `Tọa độ: ${parseFloat(req.query.lat).toFixed(5)}, ${parseFloat(req.query.lon).toFixed(5)}` });
  }
});

module.exports = router;
