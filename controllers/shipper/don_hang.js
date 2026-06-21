const mongoose = require('mongoose'); 
const Order = require('../../models/Order'); 
const User = require('../../models/User'); 

// =========================================================================
// 1. LẤY DANH SÁCH ĐƠN HÀNG DÀNH CHO SHIPPER (ĐÃ BỔ SUNG ĐỒNG BỘ HÌNH ẢNH)
// =========================================================================
// =========================================================================
// 1. LẤY DANH SÁCH ĐƠN HÀNG DÀNH CHO SHIPPER (CHỈ THẤY ĐƠN READY + KHỚP CHI NHÁNH)
// =========================================================================
exports.getshipper_donhang = async (req, res) => {
  try {
    const { shipper_id } = req.query;

    console.log("=========================================");
    console.log("🚀 [DEBUG] Nhận request tìm đơn cho shipper_id:", shipper_id);

    // 🛡️ TẦNG 1: Chặn biến rác từ Frontend
    if (!shipper_id || shipper_id === 'undefined' || shipper_id === 'null') {
      return res.status(400).json({ success: false, message: "Thiếu mã định danh ID của tài xế!" });
    }

    // 🔍 TẦNG 2: Tìm kiếm thông tin tài xế để lấy chi nhánh làm việc (branch_id)
    const thongTinShipper = await User.findOne({
      $or: [
        { _id: shipper_id },
        { _id: mongoose.Types.ObjectId.isValid(shipper_id) ? new mongoose.Types.ObjectId(shipper_id) : null }
      ]
    });
    
    if (!thongTinShipper) {
      console.log(`❌ [DEBUG] LỖI: Không tìm thấy tài xế [${shipper_id}] trong DB.`);
      return res.status(404).json({ success: false, message: "Không tìm thấy tài xế trên hệ thống!" });
    }

    let branch_id = thongTinShipper.branch_id;
    if (!branch_id) {
      console.log("❌ [DEBUG] LỖI: Tài xế chưa được gán chi nhánh.");
      return res.status(400).json({ success: false, message: "Tài xế chưa được gán chi nhánh làm việc!" });
    }

    const branchStr = branch_id.toString();
    const branchObjectId = mongoose.Types.ObjectId.isValid(branchStr) ? new mongoose.Types.ObjectId(branchStr) : null;

    // 🛒 TẦNG 3: TRUY VẤN ĐƠN HÀNG THEO YÊU CẦU NGHIỆP VỤ MỚI
    const queryDieuKien = {
      order_type: 'online', // Chỉ ship đơn online
      $and: [
        // Điều kiện bắt buộc: Đơn hàng và Shipper PHẢI CÙNG CHI NHÁNH
        {
          $or: [
            { branch_id: branchStr },
            { branch_id: branchObjectId }
          ]
        },
        // Điều kiện phân luồng trạng thái nhận đơn
        {
          $or: [
            // Luồng 1: Đơn của chi nhánh ĐÃ CHUẨN BỊ XONG (ready) và CHƯA CÓ ai nhận -> Hiện ở tab "Chờ lấy"
            {
              status: 'ready', 
              $or: [
                { shipper_id: { $exists: false } },
                { shipper_id: null },
                { shipper_id: { $type: "null" } }
              ]
            },
            // Luồng 2: Các đơn mà chính Shipper này đang đi giao (shipping) hoặc đã xử lý xong (completed, failed)
            { 
              $or: [
                { shipper_id: shipper_id },
                { shipper_id: mongoose.Types.ObjectId.isValid(shipper_id) ? new mongoose.Types.ObjectId(shipper_id) : null }
              ]
            }
          ]
        }
      ]
    };

    console.log(`🔍 [DEBUG] Đang quét đơn hàng thuộc chi nhánh [${branchStr}]...`);

    // Tiến hành query dữ liệu và nạp thông tin hình ảnh ('avatar') từ bảng Product
    const danhSachDonHang = await Order.find(queryDieuKien)
      .populate('customer_id', 'full_name phone')
      .populate({
        path: 'items.product_id',
        select: 'product_name avatar images' // ✅ SỬA TẠI ĐÂY: Gọi đúng trường 'avatar' và 'images' từ ProductSchema
      })
      .sort({ createdAt: -1 });

    // ✨ CHUẨN HÓA DỮ LIỆU ĐỂ TRẢ VỀ CHO FRONTEND ĐỒNG NHẤT
    const duLieuSauFormat = danhSachDonHang.map(order => {
      const orderObj = order.toObject();
      
      if (Array.isArray(orderObj.items)) {
        orderObj.items = orderObj.items.map(item => {
          // Trích xuất linh hoạt: Ưu tiên lấy trường 'avatar', nếu không có thì lấy ảnh đầu tiên trong mảng 'images'
          const verifiedImage = item.product_id?.avatar || (item.product_id?.images?.[0]) || "";
          
          return {
            ...item,
            image: verifiedImage // ✅ Gán ra thuộc tính phẳng 'image' để Frontend chỉ cần gọi item.image
          };
        });
      }
      return orderObj;
    });

    console.log(`📊 [DEBUG] THÀNH CÔNG: Đã lọc và xử lý ảnh cho [${duLieuSauFormat.length}] đơn hàng.`);
    console.log("=========================================");

    return res.status(200).json({
      success: true,
      branch_id: branchStr,
      data: duLieuSauFormat
    });

  } catch (error) {
    console.error("❌ LỖI SẬP BACKEND (CRASH):", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống không thể tải dữ liệu đơn hàng!",
      error: error.message
    });
  }
};

// =========================================================================
// 2. TÀI XẾ BẤM NHẬN ĐƠN (CẬP NHẬT TRẠNG THÁI: READY -> SHIPPING)
// =========================================================================
exports.nhan_donhang = async (req, res) => {
  try {
    const { id } = req.params; 
    const { shipper_id } = req.body; 

    // 🛡️ Tầng phòng thủ định dạng ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Mã đơn hàng (ID) không đúng định dạng hoặc bị thiếu!" });
    }

    if (!shipper_id || shipper_id === 'undefined' || shipper_id === 'null' || !mongoose.Types.ObjectId.isValid(shipper_id)) {
      return res.status(400).json({ success: false, message: "Không tìm thấy thông tin định danh tài xế nhận đơn hợp lệ!" });
    }

    // 🔒 SỬ DỤNG ATOMIC UPDATE: Đã loại bỏ hoàn toàn bẫy dữ liệu { shipper_id: "" } gây lỗi CastObjectId
    const donHangCapNhat = await Order.findOneAndUpdate(
      {
        _id: id,
        status: 'ready',
        $or: [
          { shipper_id: { $exists: false } },
          { shipper_id: null },
          { shipper_id: { $type: "null" } }
        ]
      },
      {
        $set: { 
          status: 'shipping',
          shipper_id: new mongoose.Types.ObjectId(shipper_id)
        },
        $push: {
          status_history: {
            status: 'shipping',
            updated_at: new Date(),
            updated_by: new mongoose.Types.ObjectId(shipper_id), 
            reason: "Tài xế đã lấy trà sữa tại quầy và bắt đầu di chuyển đi giao."
          }
        }
      },
      { new: true } 
    );

    // 🚫 Nếu không tìm thấy đơn, điều tra chi tiết lý do để bắn lỗi chính xác lên giao diện ứng dụng
    if (!donHangCapNhat) {
      const donThucTe = await Order.findById(id);
      if (!donThucTe) {
        return res.status(404).json({ success: false, message: "Đơn hàng này không tồn tại trên hệ thống!" });
      }
      if (donThucTe.status === 'preparing') {
        return res.status(400).json({ success: false, message: "Quán vẫn đang chuẩn bị nước, vui lòng đợi trạng thái sẵn sàng!" });
      }
      if (donThucTe.shipper_id && donThucTe.shipper_id.toString() !== shipper_id.toString()) {
        return res.status(400).json({ success: false, message: "Đơn hàng này đã bị một tài xế khác nhận mất rồi!" });
      }
      return res.status(400).json({ success: false, message: "Cấu trúc trạng thái đơn hiện tại không phù hợp để nhận!" });
    }

    return res.status(200).json({
      success: true,
      message: "Nhận đơn thành công! Hãy di chuyển cẩn thận nhé tài xế.",
      data: donHangCapNhat
    });
  } catch (error) {
    console.error("❌ Lỗi xử lý nhận đơn hàng:", error.message);
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

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Mã đơn hàng (ID) không đúng định dạng!" });
    }

    const donHang = await Order.findById(id);
    if (!donHang) {
      return res.status(404).json({ success: false, message: "Không tìm thấy thông tin đơn hàng này!" });
    }

    // 🛡️ Kiểm tra trạng thái vận hành
    if (donHang.status !== 'shipping') {
      return res.status(400).json({ success: false, message: "Chỉ đơn hàng ở trạng thái đang đi giao mới có thể xác nhận hoàn thành!" });
    }

    // 💵 Cập nhật trạng thái thành công
    donHang.status = 'completed';
    if (donHang.payment_method === 'CASH' || donHang.payment_method === 'tien_mat') {
      donHang.payment_status = 'PAID';
    }

    // 📝 Lưu vết lịch sử chuyển trạng thái
    if (!donHang.status_history) donHang.status_history = [];
    donHang.status_history.push({
      status: 'completed',
      updated_at: new Date(),
      updated_by: donHang.shipper_id, 
      reason: "Giao thành công trà sữa và thu tiền từ khách hàng (nếu trả tiền mặt)."
    });

    await donHang.save();

    return res.status(200).json({
      success: true,
      message: "Chúc mừng bạn đã hoàn thành xuất sắc ca giao hàng này!",
      data: donHang
    });
  } catch (error) {
    console.error("❌ Lỗi hoàn thành đơn hàng:", error.message);
    return res.status(500).json({
      success: false,
      message: "Gặp lỗi khi xử lý hoàn thành đơn hàng!",
      error: error.message
    });
  }
};

// =========================================================================
// 4. BÁO CÁO GIAO HÀNG THẤT BẠI / KHÁCH BOM (SHIPPING -> FAILED)
// =========================================================================
exports.giao_that_bai_donhang = async (req, res) => {
  try {
    const { id } = req.params;
    const { ly_do_that_bai } = req.body; 

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Mã đơn hàng (ID) không đúng định dạng!" });
    }

    const donHang = await Order.findById(id);
    if (!donHang) {
      return res.status(404).json({ success: false, message: "Không tìm thấy thông tin đơn hàng này!" });
    }

    if (donHang.status !== 'shipping') {
      return res.status(400).json({ success: false, message: "Trạng thái đơn không hợp lệ! Đơn hàng phải ở trạng thái đang giao mới có thể báo thất bại." });
    }

    // ❌ Cập nhật thông tin hủy / bom đơn theo đúng Schema của bạn
    donHang.status = 'failed';
    donHang.cancel_reason = ly_do_that_bai || "Khách hàng không nghe máy / Bom hàng";
    
    if (donHang.payment_method === 'CASH' || donHang.payment_method === 'tien_mat') {
      donHang.payment_status = 'UNPAID'; 
    }

    // 📝 Lưu vết lịch sử lỗi
    if (!donHang.status_history) donHang.status_history = [];
    donHang.status_history.push({
      status: 'failed',
      updated_at: new Date(),
      updated_by: donHang.shipper_id,
      reason: `Tài xế báo giao thất bại. Lý do cụ thể: ${donHang.cancel_reason}. Trả nước về quầy.`
    });

    await donHang.save();

    return res.status(200).json({
      success: true,
      message: "Đã ghi nhận giao thất bại. Vui lòng mang túi trà sữa quay đầu hoàn trả lại quầy chi nhánh!",
      data: donHang
    });
  } catch (error) {
    console.error("❌ Phát hiện lỗi xử lý giao thất bại:", error.message);
    return res.status(500).json({
      success: false,
      message: "Gặp lỗi khi xử lý báo cáo giao hàng thất bại!",
      error: error.message
    });
  }
};