const Order = require('../../models/Order');
const User = require('../../models/User');

/**
 * 1. THỐNG KÊ THEO TÀI KHOẢN KHÁCH HÀNG
 * Lấy danh sách khách hàng kèm tổng số đơn hàng đã mua và tổng số tiền họ đã chi tiêu (Chỉ tính đơn completed)
 */
exports.thongKeTheoKhachHang = async (req, res) => {
  try {
    const data = await Order.aggregate([
      // Chỉ lọc các đơn hàng đã hoàn thành và có tài khoản khách hàng định danh
      { $match: { status: 'completed', customer_id: { $ne: null } } },
      
      // Nhóm theo id khách hàng
      {
        $group: {
          _id: '$customer_id',
          tongSoDonHang: { $sum: 1 },
          tongTienChiTieu: { $sum: '$total_amount' }
        }
      },
      
      // Liên kết với collection users để lấy thông tin chi tiết của khách
      {
        $lookup: {
          from: 'users', // Tên collection trong MongoDB (thường viết hoa số nhiều hoặc thường tùy cấu hình, mặc định mongoose là 'users')
          localField: '_id',
          foreignField: '_id',
          as: 'khachHangInfo'
        }
      },
      
      // Giải phẳng mảng khachHangInfo vừa lookup
      { $unwind: '$khachHangInfo' },
      
      // Định hình cấu trúc dữ liệu trả về gọn gàng
      {
        $project: {
          _id: 1,
          tongSoDonHang: 1,
          tongTienChiTieu: 1,
          full_name: '$khachHangInfo.full_name',
          email: '$khachHangInfo.email',
          phone: '$khachHangInfo.phone'
        }
      },
      
      // Sắp xếp người chi nhiều tiền nhất lên đầu
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
 * Thống kê xem món nước nào bán chạy nhất, tổng số lượng ly bán ra và doanh thu của món đó
 */
exports.thongKeTheoMatHang = async (req, res) => {
  try {
    const data = await Order.aggregate([
      // Chỉ tính các đơn hàng thành công
      { $match: { status: 'completed' } },
      
      // Giải phẳng mảng items (danh sách món uống trong đơn) ra thành từng dòng riêng biệt
      { $unwind: '$items' },
      
      // Nhóm theo tên sản phẩm hoặc ID sản phẩm
      {
        $group: {
          _id: '$items.product_name', // Hoặc dùng '$items.product_id'
          tongSoLuongBan: { $sum: '$items.quantity' },
          tongDoanhThuMon: { $sum: '$items.subtotal' }
        }
      },
      
      // Sắp xếp món bán chạy nhất lên đầu
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
 * Tự động phân tích doanh thu dựa vào thời gian tạo đơn hàng (createdAt)
 */
exports.thongKeTheoThoiGian = async (req, res) => {
  try {
    const { kieu } = req.query; // Nhận lên từ query: 'thang', 'quy', hoặc 'nam'

    let groupStage = {};

    if (kieu === 'quy') {
      // Nhóm theo Năm và Quý trong năm
      groupStage = {
        _id: {
          nam: { $year: '$createdAt' },
          quy: { $ceil: { $divide: [{ $month: '$createdAt' }, 3] } }
        }
      };
    } else if (kieu === 'nam') {
      // Nhóm duy nhất theo Năm
      groupStage = {
        _id: { nam: { $year: '$createdAt' } }
      };
    } else {
      // Mặc định hoặc khi truyền 'thang': Nhóm theo Năm và Tháng
      groupStage = {
        _id: {
          nam: { $year: '$createdAt' },
          thang: { $month: '$createdAt' }
        }
      };
    }

    // Thêm các trường tính toán chung vào group
    groupStage.tongDonHang = { $sum: 1 };
    groupStage.doanhThu = { $sum: '$total_amount' };
    groupStage.tongTienGiaoHang = { $sum: '$shipping_fee' };

    const rawData = await Order.aggregate([
      { $match: { status: 'completed' } },
      { $group: groupStage },
      // Sắp xếp thời gian gần đây nhất lên trước
      { $sort: { '_id.nam': -1, '_id.thang': -1, '_id.quy': -1 } }
    ]);

    // Format lại dữ liệu đầu ra cho Frontend dễ vẽ biểu đồ (Chart)
    const data = rawData.map(item => {
      let nhanThoiGian = `Năm ${item._id.nam}`;
      if (item._id.thang) nhanThoiGian = `Tháng ${item._id.thang}/${item._id.nam}`;
      if (item._id.quy) nhanThoiGian = `Quý ${item._id.quy} - Năm ${item._id.nam}`;

      return {
        thoiGian: nhanThoiGian,
        tongDonHang: item.tongDonHang,
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