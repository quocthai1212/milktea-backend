const Order = require('../../models/Order'); 

/**
 * ----------------------------------------------------
 * 1. [GET ALL] - Tải danh sách đơn hàng theo chi nhánh
 * ----------------------------------------------------
 */
const loadDanhSachDonHangChiNhanh = async (req, res) => {
  try {
    // Lấy branch_id và role_id từ headers do frontend truyền lên (hoặc từ req.user nếu có middleware khác)
    // Tạm thời giữ nguyên logic gốc của bạn, nếu chạy lỗi chỗ này hãy báo tôi nhé!
    const { branch_id, role_id } = req.user || req.headers; 

    if (Number(role_id) !== 1 && Number(role_id) !== 2) {
      return res.status(403).json({ success: false, message: 'Từ chối truy cập! Bạn không có quyền quản lý đơn hàng.' });
    }

    if (Number(role_id) === 2 && !branch_id) {
      return res.status(400).json({ success: false, message: 'Tài khoản nhân viên chưa được liên kết chi nhánh!' });
    }

    let dieuKienLoc = {};
    const danhSachTrangThaiEnum = ['pending', 'preparing', 'ready', 'shipping', 'completed', 'failed', 'cancelled'];

    if (Number(role_id) === 1) {
      dieuKienLoc = { status: { $in: danhSachTrangThaiEnum } };
    } else {
      dieuKienLoc = { branch_id: branch_id, status: { $in: danhSachTrangThaiEnum } };
    }

    const danhSachDonHang = await Order.find(dieuKienLoc)
      .populate({ path: 'branch_id', select: 'branch_name shop_address' })
      .populate({ path: 'staff_id', select: 'full_name phone' }) 
      .populate({ path: 'shipper_id', select: 'full_name phone' }) 
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: 'Đồng bộ danh sách hóa đơn thành công!',
      orders: danhSachDonHang
    });

  } catch (error) {
    console.error('❌ Lỗi tại GetAll đơn hàng:', error);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ hệ thống chi nhánh!', error: error.message });
  }
};

/**
 * ----------------------------------------------------
 * 2. [UPDATE] - Cập nhật trạng thái tiến trình / Hủy đơn
 * ----------------------------------------------------
 */
const capNhatTrangThaiDonHang = async (req, res) => {
  try {
    const { order_id, status, reason, shipper_id } = req.body; 
    
    // 🌟 SỬA TẠI ĐÂY: Lấy trực tiếp từ Header 'X-User-Id' (Frontend gửi lên) thay vì req.user
    const current_user_id = req.headers['x-user-id'] || req.body.userId; 
    const role_id = req.headers['x-role-id'] || (req.user && req.user.role_id);
    const branch_id = req.headers['x-branch-id'] || (req.user && req.user.branch_id);

    if (!order_id || !status) {
      return res.status(400).json({ success: false, message: 'Thiếu mã đơn hàng hoặc trạng thái cần cập nhật!' });
    }

    const danhSachTrangThaiEnum = ['pending', 'preparing', 'ready', 'shipping', 'completed', 'failed', 'cancelled'];
    if (!danhSachTrangThaiEnum.includes(status)) {
      return res.status(400).json({ success: false, message: 'Trạng thái cập nhật không hợp lệ!' });
    }

    const donHang = await Order.findById(order_id);
    if (!donHang) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hóa đơn trên hệ thống!' });
    }

    // Kiểm tra quyền chi nhánh nếu có thông tin branch_id
    if (branch_id && Number(role_id) === 2 && donHang.branch_id.toString() !== branch_id.toString()) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền xử lý đơn thuộc chi nhánh khác!' });
    }

    let noiDungLichSu = '';
    switch (status) {
      case 'preparing':
        noiDungLichSu = 'Cửa hàng đã tiếp nhận đơn và đang chuẩn bị món ăn / thức uống cho bạn.';
        break;
      case 'ready':
        noiDungLichSu = 'Món ăn đã được quầy chuẩn bị xong. Đang đợi tài xế đến nhận hàng để đi giao.';
        break;
      case 'shipping':
        noiDungLichSu = 'Đơn hàng đã được bàn giao cho tài xế và đang trên đường giao tới bạn.';
        break;
      case 'completed':
        noiDungLichSu = 'Giao hàng thành công. Cảm ơn bạn đã lựa chọn Milktea Paradise!';
        break;
      case 'cancelled':
        noiDungLichSu = `Đơn hàng đã bị hủy bởi chi nhánh. Lý do: ${reason || 'Nhân viên quầy chủ động hủy.'}`;
        break;
      default:
        noiDungLichSu = `Trạng thái đơn hàng được cập nhật sang [${status}].`;
    }

    // --- LOGIC LƯU ID NHÂN VIÊN XÁC NHẬN ĐẦU TIÊN (KHÔNG DÙNG TOKEN) ---
    if (status !== 'pending') {
      if (!current_user_id) {
        return res.status(401).json({ success: false, message: 'Hệ thống không nhận diện được ID nhân viên thao tác!' });
      }

      // Nếu đơn hàng chưa có ai gán staff_id, tiến hành lưu ID người bấm đầu tiên
      if (!donHang.staff_id) {
        donHang.staff_id = current_user_id;
        donHang.markModified('staff_id'); 
      }
    }

    if (shipper_id) {
      donHang.shipper_id = shipper_id;
      donHang.markModified('shipper_id');
    }

    donHang.status = status;
    if (status === 'cancelled') {
      donHang.cancel_reason = reason || 'Nhân viên quầy chủ động hủy (Không để lại lý do)';
    }

    if (!donHang.status_history) {
      donHang.status_history = [];
    }

    donHang.status_history.push({
      status: status,
      updated_at: new Date(),
      reason: noiDungLichSu,
      updated_by: current_user_id 
    });

    await donHang.save();

    const updatedOrder = await Order.findById(donHang._id)
      .populate({ path: 'branch_id', select: 'branch_name shop_address' })
      .populate({ path: 'staff_id', select: 'full_name phone' })
      .populate({ path: 'shipper_id', select: 'full_name phone' });

    return res.status(200).json({
      success: true,
      message: `Cập nhật trạng thái đơn sang [${status}] thành công!`,
      data: updatedOrder
    });

  } catch (error) {
    console.error('❌ Lỗi tại Update đơn hàng:', error);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ, không thể cập nhật hóa đơn!', error: error.message });
  }
};

module.exports = {
  loadDanhSachDonHangChiNhanh,
  capNhatTrangThaiDonHang
};