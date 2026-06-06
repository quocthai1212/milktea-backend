const Promotion = require('../../models/Promotion'); // Đường dẫn tương đối trỏ đến file model Promotion của bạn

/**
 * Lấy danh sách mã giảm giá đang hoạt động và hợp lệ cho khách hàng chọn
 * URL: GET /api/khachhang/promotions/active
 */
exports.getDanhSachKhuyenMaiActive = async (req, res) => {
  try {
    const bayGio = new Date();

    // Tìm các mã khuyến mãi thỏa mãn các điều kiện thực tế của PromotionSchema:
    // 1. is_active = true (Đang được kích hoạt)
    // 2. Thời gian hiện tại phải nằm trong khoảng start_date và end_date
    // 3. Số lượt đã dùng (used_count) phải nhỏ hơn giới hạn (usage_limit), hoặc usage_limit là null (không giới hạn)
    const danhSachKhuyenMai = await Promotion.find({
      is_active: true,
      start_date: { $lte: bayGio },
      end_date: { $gte: bayGio },
      $or: [
        { usage_limit: null },
        { $expr: { $lt: ["$used_count", "$usage_limit"] } }
      ]
    }).sort({ discount_value: -1 }); // Ưu tiên xếp mã giảm nhiều tiền nhất lên đầu danh sách

    return res.status(200).json({
      success: true,
      count: danhSachKhuyenMai.length,
      data: danhSachKhuyenMai
    });

  } catch (error) {
    console.error("Lỗi tại controller khuyenmai khách hàng:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống, không thể tải danh sách mã giảm giá!",
      error: error.message
    });
  }
};