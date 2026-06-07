const Order = require('../../models/Order'); // Import Model đơn hàng

/**
 * @desc    Lấy toàn bộ danh sách đơn hàng cho giao diện nhân viên
 * @route   GET /api/nhanvien/don-hang
 */
const loadDanhSachDonHang = async (req, res) => {
  try {
    const orders = await Order.find({})
      .populate({
        path: 'customer_id', 
        select: 'full_name phone email' 
      })
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: 'Tải danh sách hóa đơn hệ thống thành công!',
      count: orders.length,
      orders: orders
    });
  } catch (error) {
    console.error("Lỗi tại loadDanhSachDonHang:", error);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi nạp đơn hàng.', error: error.message });
  }
};

/**
 * @desc    Nhân viên chuyển đổi trạng thái đơn (Chờ xác nhận -> Đang pha chế -> Đang giao...)
 * @route   POST /api/nhanvien/don-hang/cap-nhat-trang-thai
 */
const capNhatTrangThaiDonHang = async (req, res) => {
  try {
    const { order_id, status, staff_id } = req.body;

    // Tìm và cập nhật trạng thái đơn hàng, đồng thời push lịch sử vào mảng status_history (theo OrderSchema)
    const updatedOrder = await Order.findByIdAndUpdate(
      order_id,
      { 
        status: status,
        staff_id: staff_id, // Ghi nhận ID nhân viên xử lý đơn này
        $push: { status_history: { status: status, updated_at: new Date() } }
      },
      { new: true } // Trả về dữ liệu mới sau khi cập nhật
    );

    if (!updatedOrder) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy mã đơn hàng này.' });
    }

    return res.status(200).json({
      success: true,
      message: `Cập nhật trạng thái đơn hàng thành công!`,
      order: updatedOrder
    });
  } catch (error) {
    console.error("Lỗi tại capNhatTrangThaiDonHang:", error);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi cập nhật trạng thái.', error: error.message });
  }
};

/**
 * @desc    Nhân viên hủy đơn hàng và ghi nhận lý do hủy đơn
 * @route   POST /api/nhanvien/don-hang/huy
 */
const huyDonHangNhanVien = async (req, res) => {
  try {
    const { order_id, reason, staff_id } = req.body;

    const cancelledOrder = await Order.findByIdAndUpdate(
      order_id,
      { 
        status: 'cancelled',
        cancel_reason: reason, // Lưu lý do hủy trực tiếp vào trường cancel_reason của OrderSchema
        staff_id: staff_id,
        $push: { status_history: { status: 'cancelled', updated_at: new Date(), reason: reason } }
      },
      { new: true }
    );

    if (!cancelledOrder) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy mã đơn hàng cần hủy.' });
    }

    return res.status(200).json({
      success: true,
      message: 'Hủy đơn hàng thành công!',
      order: cancelledOrder
    });
  } catch (error) {
    console.error("Lỗi tại huyDonHangNhanVien:", error);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi hủy đơn.', error: error.message });
  }
};

// Xuất toàn bộ các hàm xử lý ra ngoài để file Route gọi tới
module.exports = {
  loadDanhSachDonHang,
  capNhatTrangThaiDonHang,
  huyDonHangNhanVien
};