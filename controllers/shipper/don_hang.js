const Order = require('../../models/Order'); 

// =========================================================================
// 1. LẤY DANH SÁCH ĐƠN HÀNG DÀNH CHO SHIPPER (ĐÃ BỔ SUNG LẤY ẢNH MÓN)
// =========================================================================
exports.getshipper_donhang = async (req, res) => {
  try {
    const { shipper_id } = req.query;

    if (!shipper_id) {
      return res.status(400).json({ 
        success: false, 
        message: "Hệ thống yêu cầu mã số ID của tài xế để đồng bộ đơn hàng!" 
      });
    }

    // Lấy đơn hàng đang chờ tài xế (preparing) hoặc đơn tài xế này đang/đã xử lý
    const danhSachDonHang = await Order.find({
      $or: [
        { status: 'preparing', order_type: 'online' }, 
        { shipper_id: shipper_id }                    
      ]
    })
    .populate('customer_id', 'full_name phone')
    // 🔥 ĐÃ ĐỔI: Populate đi sâu vào items để lấy chính xác trường "image" từ bảng Product
    .populate({
      path: 'items.product_id',
      select: 'image' 
    })
    .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: danhSachDonHang
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống không thể lấy danh sách đơn giao!",
      error: error.message
    });
  }
};

// =========================================================================
// 2. TÀI XẾ BẤM NHẬN ĐƠN (CẬP NHẬT TRẠNG THÁI: PREPARING -> SHIPPING)
// =========================================================================
exports.nhan_donhang = async (req, res) => {
  try {
    const { id } = req.params; 
    const { shipper_id } = req.body; 

    if (!shipper_id) {
      return res.status(400).json({ success: false, message: "Không tìm thấy thông tin tài xế nhận đơn!" });
    }

    const kiemTraDon = await Order.findById(id);
    if (!kiemTraDon) {
      return res.status(404).json({ success: false, message: "Đơn hàng này không tồn tại trên hệ thống!" });
    }
    
    if (kiemTraDon.shipper_id && kiemTraDon.shipper_id.toString() !== shipper_id) {
      return res.status(400).json({ success: false, message: "Đơn hàng này đã bị một tài xế khác nhận mất rồi!" });
    }

    kiemTraDon.status = 'shipping';
    kiemTraDon.shipper_id = shipper_id;
    
    // 🛡️ PHÒNG THỦ: Khởi tạo mảng trống nếu lịch sử cũ bị undefined/null
    if (!kiemTraDon.status_history) {
      kiemTraDon.status_history = [];
    }

    kiemTraDon.status_history.push({
      status: 'shipping',
      updated_at: new Date(),
      reason: "Tài xế đã lấy trà sữa tại quầy và bắt đầu đi giao."
    });

    await kiemTraDon.save();

    return res.status(200).json({
      success: true,
      message: "Nhận đơn thành công! Hãy di chuyển cẩn thận nhé tài xế.",
      data: kiemTraDon
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Gặp lỗi khi xử lý nhận đơn hàng!",
      error: error.message
    });
  }
};

// =========================================================================
// 3. XÁC NHẬN ĐÃ GIAO XONG ĐƠN HÀNG (CẬP NHẬT TRẠNG THÁI: SHIPPING -> COMPLETED)
// =========================================================================
exports.hoan_thanh_donhang = async (req, res) => {
  try {
    const { id } = req.params;

    const donHang = await Order.findById(id);
    if (!donHang) {
      return res.status(404).json({ success: false, message: "Không tìm thấy thông tin đơn hàng này!" });
    }

    if (donHang.status !== 'shipping') {
      return res.status(400).json({ success: false, message: "Chỉ đơn hàng đang đi giao mới có thể xác nhận hoàn thành!" });
    }

    donHang.status = 'completed';
    
    if (donHang.payment_method === 'CASH') {
      donHang.payment_status = 'PAID';
    }

    // 🛡️ PHÒNG THỦ: Khởi tạo mảng trống nếu lịch sử cũ bị undefined/null
    if (!donHang.status_history) {
      donHang.status_history = [];
    }

    donHang.status_history.push({
      status: 'completed',
      updated_at: new Date(),
      reason: "Giao trà sữa thành công cho khách hàng."
    });

    await donHang.save();

    return res.status(200).json({
      success: true,
      message: "Chúc mừng bạn đã hoàn thành xuất sắc ca giao hàng này!",
      data: donHang
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Gặp lỗi khi xử lý hoàn thành đơn hàng!",
      error: error.message
    });
  }
};

// =========================================================================
// 4. BÁO CÁO GIAO HÀNG THẤT BẠI (SHIPPING -> FAILED) - CHỐNG SẬP 500 TUYỆT ĐỐI
// =========================================================================
exports.giao_that_bai_donhang = async (req, res) => {
  try {
    const { id } = req.params;
    const { ly_do_that_bai } = req.body; 

    const donHang = await Order.findById(id);
    if (!donHang) {
      return res.status(404).json({ success: false, message: "Không tìm thấy thông tin đơn hàng này!" });
    }

    if (donHang.status !== 'shipping') {
      return res.status(400).json({ 
        success: false, 
        message: "Trạng thái đơn không hợp lệ! Đơn hàng phải ở trạng thái đang giao." 
      });
    }

    donHang.status = 'failed';
    donHang.cancel_reason = ly_do_that_bai || "Khách hàng không nghe máy / Bom hàng";
    
    if (donHang.payment_method === 'CASH') {
      donHang.payment_status = 'UNPAID'; 
    }

    // 🛡️ PHÒNG THỦ TUYỆT ĐỐI: Tạo mảng lịch sử trống ngay lập tức nếu dữ liệu cũ trống
    if (!donHang.status_history) {
      donHang.status_history = [];
    }

    donHang.status_history.push({
      status: 'failed',
      updated_at: new Date(),
      reason: `Tài xế báo giao thất bại. Lý do: ${donHang.cancel_reason}. Yêu cầu mang nước quay đầu trả về quán.`
    });

    await donHang.save();

    return res.status(200).json({
      success: true,
      message: "Đã ghi nhận giao thất bại. Vui lòng mang túi trà sữa quay đầu hoàn trả lại quầy!",
      data: donHang
    });
  } catch (error) {
    // Ghi vết lỗi rõ ràng ra cửa sổ Terminal phục vụ debug
    console.error("❌ Phát hiện lỗi xử lý giao thất bại:", error.message);
    
    return res.status(500).json({
      success: false,
      message: "Gặp lỗi khi xử lý báo cáo giao hàng thất bại!",
      error: error.message
    });
  }
};