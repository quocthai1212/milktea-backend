const Promotion = require('../../models/Promotion');
const UserPromotion = require('../../models/UserPromotion');

/**
 * @desc    Lấy tất cả voucher đang chạy để hiển thị ở trang Khuyến Mãi
 * @route   GET /api/khachhang/khuyenmai/all
 * @access  Public (TRUYỀN ID TRỰC TIẾP QUA QUERY NẾU CÓ)
 */
exports.getAllPromotions = async (req, res) => {
  try {
    const ngayHienTai = new Date();

    // Tìm các mã đang active và nằm trong thời gian cho phép
    const promotions = await Promotion.find({
      is_active: true,
      end_date: { $gte: ngayHienTai },
      start_date: { $lte: ngayHienTai }
    }).sort({ createdAt: -1 }).lean(); // Thêm .lean() để tăng tốc độ truy vấn tối đa

    let claimedIds = [];
    
    // Đã đồng bộ bắt cả camelCase lẫn snake_case từ Frontend gửi lên
    const userId = req.query.user_id || req.query.userId;
    
    if (userId) {
      const userWallets = await UserPromotion.find({ 
        user_id: userId 
      }).select('promotion_id').lean();
      
      claimedIds = userWallets.map(item => item.promotion_id.toString());
    }

    return res.status(200).json({
      success: true,
      data: promotions,
      claimedIds: claimedIds // Trả về danh sách ID đã lưu để FE đổi trạng thái nút
    });
  } catch (error) {
    console.error("Lỗi getAllPromotions:", error);
    return res.status(500).json({ success: false, message: "Lỗi hệ thống máy chủ!" });
  }
};

/**
 * @desc    Khách hàng bấm nhận mã giảm giá (Collectible) lưu vào ví
 * @route   POST /api/khachhang/khuyenmai/claim
 * @access  Public (TRUYỀN ID TRỰC TIẾP QUA BODY)
 */
exports.claimPromotion = async (req, res) => {
  try {
    const { promotion_id, user_id, userId: alternativeUserId } = req.body; 
    const userId = user_id || alternativeUserId; // Đề phòng Frontend truyền nhầm biến camelCase ở body

    if (!userId) {
      return res.status(400).json({ success: false, message: "Thiếu thông tin ID người dùng (user_id)!" });
    }

    if (!promotion_id) {
      return res.status(400).json({ success: false, message: "Thiếu ID mã giảm giá!" });
    }

    // 1. Tìm thông tin voucher
    const promotion = await Promotion.findById(promotion_id);
    if (!promotion) {
      return res.status(404).json({ success: false, message: "Không tìm thấy chương trình giảm giá này!" });
    }

    // 2. Phải là loại collectible mới cho bấm nhận
    if (promotion.promotion_type !== 'collectible') {
      return res.status(400).json({ success: false, message: "Mã này áp dụng tự động, không cần lưu vào ví!" });
    }

    // 3. Check thời gian và trạng thái kích hoạt
    const ngayHienTai = new Date();
    if (!promotion.is_active || promotion.end_date < ngayHienTai || promotion.start_date > ngayHienTai) {
      return res.status(400).json({ success: false, message: "Mã giảm giá đã hết hạn sử dụng hoặc chưa được mở!" });
    }

    // 4. Check số lượng phát hành tối đa (usage_limit) nếu có đặt
    if (promotion.usage_limit !== null && promotion.claimed_count >= promotion.usage_limit) {
      return res.status(400).json({ success: false, message: "Mã giảm giá này đã được thu thập hết!" });
    }

    // 5. Kiểm tra khách hàng đã nhận mã này trước đó chưa
    const daNhanChua = await UserPromotion.findOne({ user_id: userId, promotion_id: promotion._id });
    if (daNhanChua) {
      return res.status(400).json({ success: false, message: "Bạn đã sở hữu mã giảm giá này trong ví rồi!" });
    }

    // 6. TIẾN HÀNH LƯU VÀO VÍ VÀ CẬP NHẬT BIẾN ĐẾM
    const viMoi = new UserPromotion({
      user_id: userId,
      promotion_id: promotion._id,
      status: 'claimed'
    });
    await viMoi.save();

    promotion.claimed_count += 1;
    await promotion.save();

    return res.status(200).json({
      success: true,
      message: "Nhận mã giảm giá thành công! Bạn có thể sử dụng khi mua hàng."
    });

  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: "Bạn đã nhận mã này rồi!" });
    }
    console.error("Lỗi claimPromotion:", error);
    return res.status(500).json({ success: false, message: "Lỗi xử lý server!" });
  }
};

/**
 * @desc    Lấy danh sách mã khả dụng hiển thị lúc Thanh toán đơn hàng (Gồm Public + Collectible đã lưu)
 * @route   GET /api/khachhang/khuyenmai/checkout-vouchers
 * @access  Public (TRUYỀN ID TRỰC TIẾP QUA URL QUERY)
 */
exports.getCheckoutVouchers = async (req, res) => {
  try {
    const ngayHienTai = new Date();
    
    const userId = req.query.user_id || req.query.userId;
    
    if (!userId) {
      return res.status(400).json({ success: false, message: "Không tìm thấy tham số dữ liệu user_id!" });
    }

    // 1. Tìm các mã PUBLIC đang hoạt động tốt (Áp dụng tự động)
    const publicVouchers = await Promotion.find({
      promotion_type: 'public',
      is_active: true,
      end_date: { $gte: ngayHienTai },
      start_date: { $lte: ngayHienTai }
    }).lean();

    // 2. Tìm các mã COLLECTIBLE mà User này ĐÃ BẤM LƯU (status = 'claimed')
    const claimedWallet = await UserPromotion.find({
      user_id: userId,
      status: 'claimed'
    })
    .populate({
      path: 'promotion_id',
      // Lọc chặt chẽ điều kiện: chỉ lấy voucher gốc đang kích hoạt và còn hạn dùng
      match: { 
        is_active: true, 
        end_date: { $gte: ngayHienTai },
        start_date: { $lte: ngayHienTai }
      } 
    });

    // 3. Chuẩn hóa dữ liệu: Lọc bỏ bản ghi null/undefined và chuyển đổi sạch sẽ thành mảng Object phẳng đơn thuần
    const collectibleVouchers = claimedWallet
      .filter(item => item.promotion_id !== null && item.promotion_id !== undefined)
      .map(item => {
        // Chuyển đổi mongoose document sang plain object để tránh lỗi đóng gói dữ liệu
        const promoObj = item.promotion_id.toObject ? item.promotion_id.toObject() : item.promotion_id;
        return promoObj;
      });

    // 4. Khử trùng lặp (Đề phòng hiếm hoi hệ thống lỗi cấu hình khiến 1 mã xuất hiện 2 lần)
    const tatCaVouchers = [...publicVouchers, ...collectibleVouchers];
    const uniqueMap = new Map();
    tatCaVouchers.forEach(v => uniqueMap.set(v._id.toString(), v));
    
    const hopNhatVouchers = Array.from(uniqueMap.values());

    return res.status(200).json({
      success: true,
      data: hopNhatVouchers
    });
  } catch (error) {
    console.error("Lỗi getCheckoutVouchers:", error);
    return res.status(500).json({ success: false, message: "Không lấy được ví voucher!" });
  }
};