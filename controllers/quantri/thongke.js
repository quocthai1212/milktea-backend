const mongoose = require('mongoose');
const Order = require('../../models/Order');
const User = require('../../models/User');

function taoBoLocKhoangNgay(tuNgay, denNgay) {
  const createdAt = {};

  if (tuNgay) {
    const start = new Date(`${tuNgay}T00:00:00.000+07:00`);
    if (!Number.isNaN(start.getTime())) createdAt.$gte = start;
  }

  if (denNgay) {
    const end = new Date(`${denNgay}T23:59:59.999+07:00`);
    if (!Number.isNaN(end.getTime())) createdAt.$lte = end;
  }

  return Object.keys(createdAt).length ? { createdAt } : {};  
}

/**
 * 1. THỐNG KÊ THEO TÀI KHOẢN KHÁCH HÀNG
 */
exports.thongKeTheoKhachHang = async (req, res) => {
  try {
    const { tuNgay, denNgay } = req.query;
    const matchStage = { 
      status: { $in: ['completed', 'failed'] }, 
      customer_id: { $ne: null },
      ...taoBoLocKhoangNgay(tuNgay, denNgay)
    };

    const data = await Order.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$customer_id',
          tongSoDonHang: { $sum: 1 },
          donThanhCong: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          donThatBai: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
          tongTienChiTieu: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$total_amount', 0] }
          }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'khachHangInfo'
        }
      },
      { $unwind: { path: '$khachHangInfo', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          tongSoDonHang: 1,
          donThanhCong: 1,
          donThatBai: 1,
          tongTienChiTieu: 1,
          full_name: { $ifNull: ['$khachHangInfo.full_name', 'Tài khoản đã bị xóa'] },
          email: { $ifNull: ['$khachHangInfo.email', 'N/A'] },
          phone: { $ifNull: ['$khachHangInfo.phone', 'N/A'] }
        }
      },
      { $sort: { tongTienChiTieu: -1 } }
    ]);

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Lỗi thống kê theo khách hàng:", error);
    return res.status(500).json({ success: false, message: "Lỗi hệ thống khi thống kê khách hàng." });
  }
};

/**
 * 2. THỐNG KÊ THEO MẶT HÀNG (SẢN PHẨM)
 */
exports.thongKeTheoMatHang = async (req, res) => {
  try {
    const { tuNgay, denNgay } = req.query;
    const matchStage = {
      status: { $in: ['completed', 'failed'] },
      ...taoBoLocKhoangNgay(tuNgay, denNgay)
    };

    const data = await Order.aggregate([
      { $match: matchStage },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product_id',
          tenSanPham: { $first: '$items.product_name' },
          tongSoLuongBan: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$items.quantity', 0] } },
          soLuongBiHoan: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, '$items.quantity', 0] } },
          tongDoanhThuMon: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$items.subtotal', 0] } }
        }
      },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'sanPhamInfo'
        }
      },
      { $unwind: { path: '$sanPhamInfo', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          tenSanPham: 1,
          tongSoLuongBan: 1,
          soLuongBiHoan: 1,
          tongDoanhThuMon: 1,
          image_url: { $ifNull: ['$sanPhamInfo.image_url', ''] }
        }
      },
      { $sort: { tongSoLuongBan: -1 } }
    ]);

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Lỗi thống kê theo mặt hàng:", error);
    return res.status(500).json({ success: false, message: "Lỗi hệ thống khi thống kê mặt hàng." });
  }
};

/**
 * 3. THỐNG KÊ DOANH THU THEO THÁNG / QUÝ / NĂM
 */
exports.thongKeTheoThoiGian = async (req, res) => {
  try {
    const { kieu, tuNgay, denNgay } = req.query; 
    let groupStage = {};
    const TZ = "Asia/Ho_Chi_Minh";
    const matchStage = {
      status: { $in: ['completed', 'failed'] },
      ...taoBoLocKhoangNgay(tuNgay, denNgay)
    };

    if (kieu === 'quy') {
      groupStage = {
        _id: {
          nam: { $year: { date: '$createdAt', timezone: TZ } },
          quy: { $ceil: { $divide: [{ $month: { date: '$createdAt', timezone: TZ } }, 3] } }
        }
      };
    } else if (kieu === 'nam') {
      groupStage = {
        _id: { nam: { $year: { date: '$createdAt', timezone: TZ } } }
      };
    } else {
      groupStage = {
        _id: {
          nam: { $year: { date: '$createdAt', timezone: TZ } },
          thang: { $month: { date: '$createdAt', timezone: TZ } }
        }
      };
    }

    groupStage.tongDonHang = { $sum: 1 };
    groupStage.donThanhCong = { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } };
    groupStage.donThatBai = { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } };
    groupStage.doanhThu = { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$total_amount', 0] } };
    groupStage.tongTienGiaoHang = { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$shipping_fee', 0] } };

    const rawData = await Order.aggregate([
      { $match: matchStage },
      { $group: groupStage },
      { $sort: { '_id.nam': -1, '_id.thang': -1, '_id.quy': -1 } }
    ]);

    const data = rawData.map(item => {
      let nhanThoiGian = `Năm ${item._id.nam}`;
      if (item._id.thang) nhanThoiGian = `Tháng ${item._id.thang}/${item._id.nam}`;
      if (item._id.quy) nhanThoiGian = `Quý ${item._id.quy} - Năm ${item._id.nam}`;

      return {
        thoiGian: nhanThoiGian,
        tongDonHang: item.tongDonHang,
        donThanhCong: item.donThanhCong,
        donThatBai: item.donThatBai,
        doanhThu: item.doanhThu,
        tongTienGiaoHang: item.tongTienGiaoHang
      };
    });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Lỗi thống kê theo thời gian:", error);
    return res.status(500).json({ success: false, message: "Lỗi hệ thống khi thống kê doanh thu." });
  }
};

/**
 * 3.1 TỔNG DOANH THU TÍCH LŨY
 */
exports.tongDoanhThuLuyKe = async (req, res) => {
  try {
    const result = await Order.aggregate([
      { $match: { status: 'completed' } },
      {
        $group: {
          _id: null,
          tong: { $sum: { $ifNull: ['$total_amount', 0] } }
        }
      }
    ]);

    const tong = (result && result[0] && result[0].tong) || 0;
    return res.status(200).json({ success: true, data: { tongDoanhThuLuyKe: tong } });
  } catch (error) {
    console.error('Lỗi lấy tổng doanh thu lũy kế:', error);
    return res.status(500).json({ success: false, message: 'Không thể lấy tổng doanh thu lũy kế.' });
  }
};

/**
 * 4. LẤY CHI TIẾT ĐƠN HÀNG PHỤC VỤ DRILL-DOWN (MODAL) - SỬA LỖI TỔNG TIỀN BẰNG 0 🌟
 */
exports.getChiTietThongKe = async (req, res) => {
  try {
    const { tab, id, kieuThoiGian, statusFilter, tuNgay, denNgay } = req.query; 

    // 1. Khởi tạo bộ lọc trạng thái cơ bản
    let matchStage = {};
    if (statusFilter === 'completed') {
      matchStage.status = 'completed';
    } else if (statusFilter === 'failed') {
      matchStage.status = 'failed';
    } else {
      matchStage.status = { $in: ['completed', 'failed'] };
    }

    // Đồng bộ khoảng ngày từ bộ lọc chính
    Object.assign(matchStage, taoBoLocKhoangNgay(tuNgay, denNgay));

    const TZ = "Asia/Ho_Chi_Minh";

    // 2. Định dạng các điều kiện lọc dựa trên Tab đang active
    if (tab === 'khachhang') {
      matchStage.customer_id = new mongoose.Types.ObjectId(id);
    } 
    else if (tab === 'mathang') {
      matchStage['items.product_id'] = new mongoose.Types.ObjectId(id);
    } 
    else if (tab === 'thoigian') {
      if (kieuThoiGian === 'nam') {
        const nam = parseInt(id.replace('Năm ', ''));
        matchStage.$expr = { $eq: [{ $year: { date: '$createdAt', timezone: TZ } }, nam] };
      } else if (kieuThoiGian === 'quy') {
        const matches = id.match(/Quý (\d+) - Năm (\d+)/);
        if (matches) {
          const quy = parseInt(matches[1]);
          const nam = parseInt(matches[2]);
          matchStage.$expr = {
            $and: [
              { $eq: [{ $year: { date: '$createdAt', timezone: TZ } }, nam] },
              { $eq: [{ $ceil: { $divide: [{ $month: { date: '$createdAt', timezone: TZ } }, 3] } }, quy] }
            ]
          };
        }
      } else {
        const matches = id.match(/Tháng (\d+)\/(\d+)/);
        if (matches) {
          const thang = parseInt(matches[1]);
          const nam = parseInt(matches[2]);
          matchStage.$expr = {
            $and: [
              { $eq: [{ $year: { date: '$createdAt', timezone: TZ } }, nam] },
              { $eq: [{ $month: { date: '$createdAt', timezone: TZ } }, thang] }
            ]
          };
        }
      }
    }

    let danhSachDonHang = [];

    // 3. Thực hiện tách biệt logic truy vấn cho Tab Mặt Hàng
    if (tab === 'mathang') {
      const targetProductId = new mongoose.Types.ObjectId(id);

      danhSachDonHang = await Order.aggregate([
        { $match: matchStage },
        {
          $lookup: {
            from: 'users',
            localField: 'customer_id',
            foreignField: '_id',
            as: 'customer_id'
          }
        },
        { $unwind: { path: '$customer_id', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'users',
            localField: 'shipper_id',
            foreignField: '_id',
            as: 'shipper_id'
          }
        },
        { $unwind: { path: '$shipper_id', preserveNullAndEmptyArrays: true } },
        { $sort: { createdAt: -1 } },
        {
          $addFields: {
            // SỬA LỖI GIÁ TRỊ: Tính toán riêng tổng tiền của mặt hàng được nhấp chuột để tránh bị nhận giá trị 0
            target_item_subtotal: {
              $sum: {
                $map: {
                  input: {
                    $filter: {
                      input: "$items",
                      as: "item",
                      cond: { $eq: ["$$item.product_id", targetProductId] }
                    }
                  },
                  as: "filtered_item",
                  in: "$$filtered_item.subtotal"
                }
              }
            }
          }
        },
        {
          $project: {
            "customer_id.password": 0,
            "customer_id.role_id": 0,
            "shipper_id.password": 0,
            "shipper_id.role_id": 0,
          }
        }
      ]);
    } else {
      // Các tab Khách Hàng và Thời Gian chạy lệnh tìm kiếm cơ bản rất nhanh và chuẩn xác
      danhSachDonHang = await Order.find(matchStage)
        .populate('customer_id', 'full_name email phone')
        .populate('shipper_id', 'full_name phone')
        .sort({ createdAt: -1 })
        .lean();
    }

    return res.status(200).json({ success: true, data: danhSachDonHang });
  } catch (error) {
    console.error("Lỗi lấy chi tiết thống kê:", error);
    return res.status(500).json({ success: false, message: "Không thể lấy chi tiết đơn hàng." });
  }
};