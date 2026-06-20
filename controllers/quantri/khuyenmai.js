// controllers/quantri/promotionController.js
const Promotion = require('../../models/Promotion');

// 1. Lấy danh sách tất cả mã giảm giá
const layTatCaPromotions = async (req, res) => {
  try {
    const list = await Promotion.find().sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: list });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Lỗi lấy danh sách mã giảm giá!", error: error.message });
  }
};

// 2. Tạo mới một mã giảm giá (Đã đồng bộ loại hình mã: public / collectible)
const taoMoiPromotion = async (req, res) => {
  try {
    const { 
      code, 
      description, 
      discount_value, 
      start_date, 
      end_date, 
      is_active, 
      usage_limit,
      promotion_type // 🌟 Nhận thêm trường phân loại từ Client gửi lên
    } = req.body;

    if (!code || !discount_value || !start_date || !end_date) {
      return res.status(400).json({ success: false, message: "Vui lòng nhập đầy đủ các trường bắt buộc!" });
    }

    // Kiểm tra mã trùng
    const checkTrung = await Promotion.findOne({ code: code.toUpperCase().trim() });
    if (checkTrung) {
      return res.status(400).json({ success: false, message: "Mã giảm giá này đã tồn tại trong hệ thống!" });
    }

    const maMoi = new Promotion({
      code: code.toUpperCase().trim(),
      description,
      discount_value: Number(discount_value),
      start_date: new Date(start_date),
      end_date: new Date(end_date),
      is_active: is_active !== undefined ? (is_active === 'true' || is_active === true) : true,
      usage_limit: usage_limit && usage_limit !== "" ? Number(usage_limit) : null,
      
      // 🌟 Lưu loại mã: Nếu không truyền lên sẽ mặc định là 'public' (công khai)
      promotion_type: promotion_type || 'public', 
      
      // Khởi tạo các giá trị mặc định ban đầu bằng 0
      claimed_count: 0, 
      used_count: 0      
    });

    await maMoi.save();
    return res.status(201).json({ success: true, message: "Tạo mã giảm giá thành công!", data: maMoi });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Lỗi tạo mã giảm giá!", error: error.message });
  }
};

// 3. Cập nhật mã giảm giá
const capNhatPromotion = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      description, 
      discount_value, 
      start_date, 
      end_date, 
      is_active, 
      usage_limit,
      promotion_type // 🌟 Nhận thêm trường phân loại để cập nhật khi cần
    } = req.body;

    // Chuyển đổi trạng thái active về Boolean chuẩn xác
    const chuanHoaIsActive = is_active !== undefined ? (is_active === 'true' || is_active === true) : true;

    const maCapNhat = await Promotion.findByIdAndUpdate(
      id,
      {
        description,
        discount_value: Number(discount_value),
        start_date: new Date(start_date),
        end_date: new Date(end_date),
        is_active: chuanHoaIsActive,
        usage_limit: usage_limit && usage_limit !== "" ? Number(usage_limit) : null,
        
        // 🌟 Cập nhật hình thức áp dụng mã
        promotion_type: promotion_type || 'public'
        // Giữ nguyên các giá trị thống kê claimed_count và used_count hiện tại
      },
      { new: true }
    );

    if (!maCapNhat) {
      return res.status(404).json({ success: false, message: "Không tìm thấy mã cần sửa!" });
    }

    return res.status(200).json({ success: true, message: "Cập nhật thành công!", data: maCapNhat });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Lỗi cập nhật mã giảm giá!", error: error.message });
  }
};

// 4. Xóa mã giảm giá
const xoaPromotion = async (req, res) => {
  try {
    const { id } = req.params;
    const xoaMa = await Promotion.findByIdAndDelete(id);
    if (!xoaMa) {
      return res.status(404).json({ success: false, message: "Không tìm thấy mã cần xóa!" });
    }
    return res.status(200).json({ success: true, message: "Xóa mã giảm giá thành công!" });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Lỗi xóa mã giảm giá!", error: error.message });
  }
};

module.exports = {
  layTatCaPromotions,
  taoMoiPromotion,
  capNhatPromotion,
  xoaPromotion
};