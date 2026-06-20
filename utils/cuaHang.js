const NodeGeocoder = require('node-geocoder');
const ShippingConfig = require('../models/ShippingConfig');
const { tinhKhoangCachKm } = require('./khoangCach');

const geocoder = NodeGeocoder({ provider: 'openstreetmap' });
const cachedBranchCoordinates = new Map();

// Hàm lấy tọa độ chi nhánh (Đã xử lý triệt để bẫy NaN để nhận giá trị phí ship = 0)
async function layToaDoChiNhanh(chiNhanh) {
  const cacheKey = `${chiNhanh._id}:${chiNhanh.updatedAt?.getTime?.() || ''}`;
  if (cachedBranchCoordinates.has(cacheKey)) {
    return cachedBranchCoordinates.get(cacheKey);
  }

  // 🛠️ GIẢI PHÁP: Kiểm tra dữ liệu thô từ DB trước để tránh lỗi bẫy ép kiểu số ra NaN
  const rawFee = chiNhanh.shipping_fee_per_km !== undefined && chiNhanh.shipping_fee_per_km !== null 
    ? chiNhanh.shipping_fee_per_km 
    : 5000;

  const rawMaxDist = chiNhanh.max_delivery_km !== undefined && chiNhanh.max_delivery_km !== null 
    ? chiNhanh.max_delivery_km 
    : 20;

  // Nếu trong database đã có sẵn số latitude và longitude thực tế
  if (chiNhanh.latitude && chiNhanh.longitude) {
    const toaDo = {
      branch_id: chiNhanh._id,
      branch_name: chiNhanh.branch_name,
      address: chiNhanh.shop_address.trim(),
      latitude: Number(chiNhanh.latitude),
      longitude: Number(chiNhanh.longitude),
      fee_per_km: Math.max(0, Number(rawFee)),
      max_distance_km: Math.max(0, Number(rawMaxDist)),
    };
    cachedBranchCoordinates.set(cacheKey, toaDo);
    return toaDo;
  }

  // Dự phòng: Nếu DB chưa có số (bằng 0), tiến hành dò chữ qua Geocoder
  const address = chiNhanh.shop_address || '';
  if (!address.trim()) {
    throw new Error(`Chi nhánh "${chiNhanh.branch_name}" chưa có địa chỉ cửa hàng!`);
  }

  const ketQua = await geocoder.geocode(address);
  if (!ketQua?.length) {
    throw new Error(`Không thể xác định tọa độ chi nhánh "${chiNhanh.branch_name}" từ địa chỉ!`);
  }

  const toaDo = {
    branch_id: chiNhanh._id,
    branch_name: chiNhanh.branch_name,
    address: address.trim(),
    latitude: Number(ketQua[0].latitude),
    longitude: Number(ketQua[0].longitude),
    fee_per_km: Math.max(0, Number(rawFee)),
    max_distance_km: Math.max(0, Number(rawMaxDist)),
  };

  cachedBranchCoordinates.set(cacheKey, toaDo);
  return toaDo;
}

/**
 * TÍNH PHÍ GIAO HÀNG CHUẨN THEO CHI NHÁNH ĐƯỢC CHỌN
 */
async function tinhPhiGiaoHang(params) {
  const lat = Number(params?.latitude);
  const lon = Number(params?.longitude);
  const branch_id = params?.branch_id || params?.branchId || params?.idChiNhanh;

  if (!lat || !lon) {
    return { error: 'Thiếu tọa độ địa chỉ giao hàng của khách!' };
  }
  if (!branch_id) {
    return { error: 'Hệ thống cần branch_id để tính khoảng cách chi nhánh!' };
  }

  try {
    // Tìm chi nhánh mà khách chọn từ CSDL
    const chiNhanhDoc = await ShippingConfig.findById(branch_id);
    if (!chiNhanhDoc) {
      return { error: 'Chi nhánh được chọn không tồn tại!' };
    }
    if (!chiNhanhDoc.is_active) {
      return { error: 'Chi nhánh này hiện đang tạm đóng cửa nghỉ bán!' };
    }

    const shop = await layToaDoChiNhanh(chiNhanhDoc);

    // Tính khoảng cách từ chi nhánh được chọn tới vị trí khách
    const distance_km = tinhKhoangCachKm(shop.latitude, shop.longitude, lat, lon);
    const max_distance_km = shop.max_distance_km;
    const fee_per_km = shop.fee_per_km;

    const within_range = distance_km <= max_distance_km;
    const shipping_fee = within_range ? Math.round(distance_km * fee_per_km) : 0;

    return {
      branch_id: shop.branch_id,
      branch_name: shop.branch_name,
      shop_address: shop.address,
      shop_latitude: shop.latitude,
      shop_longitude: shop.longitude,
      distance_km: Math.round(distance_km * 10) / 10, // Làm tròn 1 chữ số thập phân cho đẹp (VD: 4.3 km)
      shipping_fee,
      fee_per_km,
      max_distance_km,
      within_range,
    };
  } catch (error) {
    return { error: error.message };
  }
}

async function layDanhSachChiNhanhGiaoHang() {
  const danhSachChiNhanh = await ShippingConfig.find({ is_active: true }).sort({ createdAt: 1 });
  const danhSachToaDo = [];
  for (const chiNhanh of danhSachChiNhanh) {
    try {
      danhSachToaDo.push(await layToaDoChiNhanh(chiNhanh));
    } catch (e) { console.error(e.message); }
  }
  return danhSachToaDo;
}

async function layToaDoCuaHang() {
  const danhSach = await ShippingConfig.find({ is_active: true }).sort({ createdAt: 1 });
  if(!danhSach.length) return null;
  return await layToaDoChiNhanh(danhSach[0]);
}

module.exports = {
  layToaDoCuaHang,
  layDanhSachChiNhanhGiaoHang,
  tinhPhiGiaoHang,
};