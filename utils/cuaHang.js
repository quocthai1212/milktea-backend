const NodeGeocoder = require('node-geocoder');
const { tinhKhoangCachKm } = require('./khoangCach');

const geocoder = NodeGeocoder({ provider: 'openstreetmap' });

let cachedShop = null;

async function layToaDoCuaHang() {
  if (cachedShop) return cachedShop;

  const address = process.env.SHOP_ADDRESS || '';
  if (!address.trim()) {
    throw new Error('Chưa cấu hình SHOP_ADDRESS trong file .env!');
  }

  let latitude = Number(process.env.SHOP_LATITUDE) || 0;
  let longitude = Number(process.env.SHOP_LONGITUDE) || 0;

  if (!latitude || !longitude) {
    const ketQua = await geocoder.geocode(address);
    if (!ketQua?.length) {
      throw new Error('Không thể xác định tọa độ cửa hàng từ SHOP_ADDRESS!');
    }
    latitude = ketQua[0].latitude;
    longitude = ketQua[0].longitude;
  }

  cachedShop = { address: address.trim(), latitude, longitude };
  return cachedShop;
}

function layGioiHanKmGiaoHang() {
  const max = Number(process.env.MAX_DELIVERY_KM);
  return Number.isFinite(max) && max > 0 ? max : 10;
}

function layPhiShipMoiKm() {
  const fee = Number(process.env.SHIPPING_FEE_PER_KM);
  return Number.isFinite(fee) && fee >= 0 ? fee : 5000;
}

async function tinhPhiGiaoHang({ latitude, longitude }) {
  const shop = await layToaDoCuaHang();
  const lat = Number(latitude);
  const lon = Number(longitude);

  if (!lat || !lon) {
    return { error: 'Thiếu tọa độ địa chỉ giao hàng!' };
  }

  const distance_km = tinhKhoangCachKm(shop.latitude, shop.longitude, lat, lon);
  const max_distance_km = layGioiHanKmGiaoHang();
  const fee_per_km = layPhiShipMoiKm();
  const shipping_fee = Math.round(distance_km * fee_per_km);
  const within_range = distance_km <= max_distance_km;

  return {
    shop_address: shop.address,
    shop_latitude: shop.latitude,
    shop_longitude: shop.longitude,
    distance_km: Math.round(distance_km * 100) / 100,
    shipping_fee,
    fee_per_km,
    max_distance_km,
    within_range,
  };
}

module.exports = {
  layToaDoCuaHang,
  layGioiHanKmGiaoHang,
  layPhiShipMoiKm,
  tinhPhiGiaoHang,
};
