const NodeGeocoder = require('node-geocoder');
const mongoose = require('mongoose');

const geocoder = NodeGeocoder({ provider: 'openstreetmap' });

async function layDistrictId() {
  try {
    const vungGiaoHangMau = await mongoose.connection.db.collection('deliveryzones').findOne({});
    if (vungGiaoHangMau) return vungGiaoHangMau._id;
    return new mongoose.Types.ObjectId();
  } catch {
    return new mongoose.Types.ObjectId();
  }
}

async function xuLyDiaChiGiaoHang({ latitude, longitude, address_text }) {
  let diaChiChuoiHoanChinh = address_text ? address_text.trim() : '';
  let viDoCuoiCung = Number(latitude) || 0;
  let kinhDoCuoiCung = Number(longitude) || 0;

  // TRƯỜNG HỢP 1: Có tọa độ thực tế từ React (Do click bản đồ, kéo ghim hoặc GPS thiết bị)
  if (viDoCuoiCung !== 0 && kinhDoCuoiCung !== 0) {
    // Nếu có chữ do React gửi kèm lên thì lấy luôn chữ đó (đỡ tốn công dịch ngược lại)
    if (!diaChiChuoiHoanChinh) {
      try {
        const ketQuaDichNguoc = await geocoder.reverse({ lat: viDoCuoiCung, lon: kinhDoCuoiCung });
        if (ketQuaDichNguoc && ketQuaDichNguoc.length > 0) {
          diaChiChuoiHoanChinh = ketQuaDichNguoc[0].formattedAddress;
        } else {
          diaChiChuoiHoanChinh = `Vị trí định vị GPS (${viDoCuoiCung}, ${kinhDoCuoiCung})`;
        }
      } catch {
        diaChiChuoiHoanChinh = `Vị trí định vị GPS (${viDoCuoiCung}, ${kinhDoCuoiCung})`;
      }
    }
  } 
  // TRƯỜNG HỢP 2: Không có tọa độ (bằng 0) nhưng có chữ thủ công -> Tiến hành Geocode để dò tọa độ
  else if (diaChiChuoiHoanChinh !== '') {
    try {
      const ketQuaTimKiem = await geocoder.geocode(diaChiChuoiHoanChinh);
      if (ketQuaTimKiem && ketQuaTimKiem.length > 0) {
        viDoCuoiCung = ketQuaTimKiem[0].latitude;
        kinhDoCuoiCung = ketQuaTimKiem[0].longitude;
      }
    } catch (geoErr) {
      console.error('Không thể geocode địa chỉ:', geoErr.message);
    }
  } 
  // TRƯỜNG HỢP 3: Trống rỗng cả hai dữ liệu
  else {
    return { error: 'Vui lòng cung cấp địa chỉ nhận hàng bằng GPS hoặc nhập thủ công!' };
  }

  // Kiểm tra lại lần cuối xem có chuỗi text địa chỉ chưa
  if (!diaChiChuoiHoanChinh.trim()) {
    return { error: 'Địa chỉ giao hàng không được để trống!' };
  }

  const district_id = await layDistrictId();

  // Trả về đúng cấu trúc Object lồng nhau, đảm bảo tọa độ mới di chuyển liên tục theo bản đồ React
  return {
    address_detail: diaChiChuoiHoanChinh,
    district_id,
    gps_location: {
      latitude: viDoCuoiCung,
      longitude: kinhDoCuoiCung,
    },
  };
}

module.exports = { xuLyDiaChiGiaoHang };