const Promotion = require('../../models/Promotion');
const UserPromotion = require('../../models/UserPromotion');

/**
 * @desc    Lấy tất cả voucher đang chạy để hiển thị ở trang Khuyến Mãi
 * @route   GET /api/khachhang/khuyenmai/all
 * @access  Public
 */
exports.getAllPromotions = async (req, res) => {
  try {
    const ngayHienTai = new Date();

    // SỬA: Chỉ lấy các mã CÒN SỐ LƯỢNG (claimed_count < usage_limit)
    const promotions = await Promotion.find({
      is_active: true,
      end_date: { $gte: ngayHienTai },
      start_date: { $lte: ngayHienTai },
      $or: [
        { usage_limit: null }, 
        { $expr: { $lt: ["$claimed_count", "$usage_limit"] } } 
      ]
    }).sort({ createdAt: -1 }).lean();

    let claimedIds = [];
    let usedIds = [];
    
    const userId = req.query.user_id || req.query.userId;
    
    if (userId) {
      const userWallets = await UserPromotion.find({ user_id: userId }).select('promotion_id status').lean();
      userWallets.forEach(item => {
        if (item.status === 'used') {
          usedIds.push(item.promotion_id.toString());
        } else {
          claimedIds.push(item.promotion_id.toString());
        }
      });
    }

    return res.status(200).json({
      success: true,
      data: promotions,
      claimedIds: claimedIds,
      usedIds: usedIds
    });
  } catch (error) {
    console.error("Lỗi getAllPromotions:", error);
    return res.status(500).json({ success: false, message: "Lỗi hệ thống máy chủ!" });
  }
};

/**
 * @desc    Khách hàng bấm nhận mã giảm giá (Collectible) lưu vào ví
 * @route   POST /api/khachhang/khuyenmai/claim
 * @access  Public
 */
exports.claimPromotion = async (req, res) => {
  try {
    const { promotion_id, user_id, userId: alternativeUserId } = req.body; 
    const userId = user_id || alternativeUserId;

    if (!userId || !promotion_id) {
      return res.status(400).json({ success: false, message: "Thiếu thông tin người dùng hoặc mã giảm giá!" });
    }

    // 1. Kiểm tra tài khoản đã từng nhận hoặc dùng chưa
    const daTuongTac = await UserPromotion.findOne({ user_id: userId, promotion_id: promotion_id });
    if (daTuongTac) {
      return res.status(400).json({ 
        success: false, 
        message: daTuongTac.status === 'used' ? "Bạn đã dùng mã này rồi!" : "Mã này đã có trong ví của bạn!" 
      });
    }

    const ngayHienTai = new Date();

    // SỬA: Trừ số lượng AN TOÀN bằng câu lệnh Atomic của MongoDB. 
    // Vừa kiểm tra điều kiện còn số lượng, vừa cộng trực tiếp dưới DB. Chống trùng lặp tuyệt đối.
    const promotion = await Promotion.findOneAndUpdate(
      {
        _id: promotion_id,
        promotion_type: 'collectible',
        is_active: true,
        start_date: { $lte: ngayHienTai },
        end_date: { $gte: ngayHienTai },
        $or: [
          { usage_limit: null },
          { $expr: { $lt: ["$claimed_count", "$usage_limit"] } }
        ]
      },
      { $inc: { claimed_count: 1 } }, // Tự động cộng số lượng hệ thống lên 1
      { new: true }
    );

    if (!promotion) {
      return res.status(400).json({ success: false, message: "Mã giảm giá đã hết lượt nhận hoặc đã hết hạn!" });
    }

    // 2. Tiến hành lưu vào ví của User
    const viMoi = new UserPromotion({
      user_id: userId,
      promotion_id: promotion._id,
      status: 'claimed'
    });
    await viMoi.save();

    return res.status(200).json({ success: true, message: "Nhận mã giảm giá thành công!" });

  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: "Bạn đã sở hữu mã này rồi!" });
    }
    console.error("Lỗi claimPromotion:", error);
    return res.status(500).json({ success: false, message: "Lỗi xử lý server!" });
  }
};

/**
 * @desc    Lấy danh sách mã khả dụng hiển thị lúc Thanh toán đơn hàng (Gồm Public + Collectible đã lưu)
 * @route   GET /api/khachhang/khuyenmai/checkout-vouchers
 * @access  Public
 */
exports.getCheckoutVouchers = async (req, res) => {
  try {
    const ngayHienTai = new Date();
    const userId = req.query.user_id || req.query.userId;
    
    if (!userId) {
      return res.status(400).json({ success: false, message: "Không tìm thấy tham số dữ liệu user_id!" });
    }

    // Tìm danh sách mã tài khoản này đã sử dụng để loại bỏ
    const userPromotions = await UserPromotion.find({ user_id: userId }).lean();
    const usedPromoIds = userPromotions
      .filter(item => item.status === 'used')
      .map(item => item.promotion_id.toString());

    // SỬA 1: Đối với mã PUBLIC, chỉ lấy những mã CÒN SỐ LƯỢNG (claimed_count < usage_limit)
    const publicVouchers = await Promotion.find({
      _id: { $nin: usedPromoIds }, 
      promotion_type: 'public',
      is_active: true,
      end_date: { $gte: ngayHienTai },
      start_date: { $lte: ngayHienTai },
      $or: [
        { usage_limit: null },
        { $expr: { $lt: ["$claimed_count", "$usage_limit"] } }
      ]
    }).lean();

    // LƯU Ý 2: Đối với mã COLLECTIBLE, vì số lượng đã bị trừ giữ chỗ từ lúc họ nhấn nút "Nhận mã",
    // nên tại đây không cần lọc claimed_count < usage_limit nữa để đảm bảo quyền lợi cho họ.
    const claimedWallet = await UserPromotion.find({
      user_id: userId,
      status: 'claimed' 
    })
    .populate({
      path: 'promotion_id',
      match: { 
        is_active: true, 
        end_date: { $gte: ngayHienTai },
        start_date: { $lte: ngayHienTai }
      } 
    }).lean();

    const collectibleVouchers = claimedWallet
      .filter(item => item.promotion_id)
      .map(item => item.promotion_id);

    const tatCaVouchers = [...publicVouchers, ...collectibleVouchers];
    const uniqueMap = new Map();
    tatCaVouchers.forEach(v => uniqueMap.set(v._id.toString(), v));
    
    return res.status(200).json({ success: true, data: Array.from(uniqueMap.values()) });
  } catch (error) {
    console.error("Lỗi getCheckoutVouchers:", error);
    return res.status(500).json({ success: false, message: "Không lấy được ví voucher!" });
  }
};
