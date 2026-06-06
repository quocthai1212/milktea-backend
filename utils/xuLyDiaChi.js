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
  let diaChiChuoiHoanChinh = '';
  let viDoCuoiCung = Number(latitude) || 0;
  let kinhDoCuoiCung = Number(longitude) || 0;

  if (address_text && address_text.trim() !== '') {
    diaChiChuoiHoanChinh = address_text.trim();

    if (viDoCuoiCung === 0 || kinhDoCuoiCung === 0) {
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
  } else if (viDoCuoiCung !== 0 && kinhDoCuoiCung !== 0) {
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
  } else {
    return { error: 'Vui lòng cung cấp địa chỉ nhận hàng bằng GPS hoặc nhập thủ công!' };
  }

  if (!diaChiChuoiHoanChinh.trim()) {
    return { error: 'Địa chỉ giao hàng không được để trống!' };
  }

  const district_id = await layDistrictId();

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
