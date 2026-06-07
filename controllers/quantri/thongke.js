const Order = require('../../models/Order');
const User = require('../../models/User');

/**
 * 1. THỐNG KÊ THEO TÀI KHOẢN KHÁCH HÀNG
 * Tối ưu: Thống kê cả số đơn thành công và số đơn bom (giao thất bại) của từng khách
 */
exports.thongKeTheoKhachHang = async (req, res) => {
  try {
    const data = await Order.aggregate([
      // Lọc các đơn đã hoàn thành HOẶC giao thất bại, loại bỏ đơn không có ID khách
      { 
        $match: { 
          status: { $in: ['completed', 'failed'] }, 
          customer_id: { $ne: null } 
        } 
      },
      
      {
        $group: {
          _id: '$customer_id',
          tongSoDonHang: { $sum: 1 },
          // Đếm đơn thành công
          donThanhCong: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          // Đếm đơn giao thất bại (Bom hàng)
          donThatBai: {
            $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
          },
          // Tiền chi tiêu chỉ tính trên đơn đã completed thành công
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
 * Tối ưu: Đo lường số lượng bán được và số lượng bị hoàn trả do giao hàng thất bại
 */
exports.thongKeTheoMatHang = async (req, res) => {
  try {
    const data = await Order.aggregate([
      { $match: { status: { $in: ['completed', 'failed'] } } },
      { $unwind: '$items' },
      
      {
        $group: {
          _id: '$items.product_id',
          tenSanPham: { $first: '$items.product_name' },
          // Tổng số lượng nằm trong các đơn giao thành công
          tongSoLuongBan: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$items.quantity', 0] }
          },
          // Tổng số lượng nằm trong các đơn bị hoàn trả / bom
          soLuongBiHoan: {
            $sum: { $cond: [{ $eq: ['$status', 'failed'] }, '$items.quantity', 0] }
          },
          // Doanh thu thực tế (chỉ tính trên đơn thành công)
          tongDoanhThuMon: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$items.subtotal', 0] }
          }
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
 * Tối ưu: Bổ sung đếm số đơn hàng thất bại để Frontend tính toán tỷ lệ hủy đơn (Cancel Rate)
 */
exports.thongKeTheoThoiGian = async (req, res) => {
  try {
    const { kieu } = req.query; 
    let groupStage = {};
    const TZ = "Asia/Ho_Chi_Minh";

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

    // Đếm tổng số hóa đơn được tạo ra (gồm cả thành công và thất bại)
    groupStage.tongDonHang = { $sum: 1 };
    
    // Đếm số đơn giao thành công
    groupStage.donThanhCong = {
      $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
    };

    // Đếm số đơn giao thất bại
    groupStage.donThatBai = {
      $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
    };

    // Tài chính: Chỉ cộng dồn tiền từ những đơn có trạng thái 'completed'
    groupStage.doanhThu = {
      $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$total_amount', 0] }
    };
    groupStage.tongTienGiaoHang = {
      $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$shipping_fee', 0] }
    };

    const rawData = await Order.aggregate([
      { $match: { status: { $in: ['completed', 'failed'] } } },
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
 * 4. LẤY CHI TIẾT ĐƠN HÀNG PHỤC VỤ DRILL-DOWN (MODAL)
 * Tối ưu: Cho phép truy xuất danh sách bao gồm cả đơn thất bại để đối soát lý do hủy đơn
 */
exports.getChiTietThongKe = async (req, res) => {
  try {
    const { tab, id, kieuThoiGian, statusFilter } = req.query; 
    // statusFilter: 'all' (mặc định), 'completed', 'failed'

    // Khởi tạo bộ lọc trạng thái linh hoạt phục vụ việc xem danh sách đơn hủy trong modal
    let matchStage = {};
    if (statusFilter === 'completed') {
      matchStage.status = 'completed';
    } else if (statusFilter === 'failed') {
      matchStage.status = 'failed';
    } else {
      matchStage.status = { $in: ['completed', 'failed'] };
    }

    const TZ = "Asia/Ho_Chi_Minh";

    if (tab === 'khachhang') {
      const mongoose = require('mongoose');
      matchStage.customer_id = new mongoose.Types.ObjectId(id);
    } 
    else if (tab === 'mathang') {
      const mongoose = require('mongoose');
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

    // Thực hiện truy vấn dữ liệu chi tiết kèm thông tin đối tác giao nhận hoặc lý do hủy đơn nếu có
    const danhSachDonHang = await Order.find(matchStage)
      .populate('customer_id', 'full_name email phone')
      .populate('shipper_id', 'full_name phone') // Bổ sung thông tin shipper để xem ai đi giao bị bom
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, data: danhSachDonHang });
  } catch (error) {
    console.error("Lỗi lấy chi tiết thống kê:", error);
    return res.status(500).json({ success: false, message: "Không thể lấy chi tiết đơn hàng." });
  }
};