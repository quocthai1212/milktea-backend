const mongoose = require('mongoose');
const ShippingConfig = require('../../models/ShippingConfig'); 
const Order = require('../../models/Order');
const Product = require('../../models/Product');
const User = require('../../models/User');
const Promotion = require('../../models/Promotion'); 
const UserPromotion = require('../../models/UserPromotion'); // Thêm Model này để xử lý ví & lịch sử ví
const Review = require('../../models/Review'); 
const { tinhPhiGiaoHang } = require('../../utils/cuaHang');

async function getAllShippingConfigs(req, res) {
  try {
    const configs = await ShippingConfig.find({}).sort({ order_index: 1 });
    
    return res.status(200).json({
      success: true,
      message: "Tải danh sách cấu hình giao hàng thành công",
      data: configs
    });
  } catch (error) {
    console.error("Lỗi khi lấy dữ liệu ShippingConfig:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể lấy cấu hình giao hàng từ hệ thống",
      error: error.message
    });
  }
}

async function resolveProductId(productId, productName) {
  if (productId && mongoose.Types.ObjectId.isValid(String(productId))) {
    const found = await Product.findById(productId);
    if (found) return found._id;
  }
  if (productName) {
    const byName = await Product.findOne({ product_name: productName });
    if (byName) return byName._id;
  }
  return null;
}

/**
 * 🌟 ĐÃ CẬP NHẬT: TÍNH PHÍ SHIP BAO LỖI BIẾN branch_id TỪ FRONTEND
 */
const tinhPhiShip = async (req, res) => {
  try {
    const { latitude, longitude } = req.query;
    const branch_id = req.query.branch_id || req.query.branchId || req.query.idChiNhanh;

    const ketQua = await tinhPhiGiaoHang({ latitude, longitude, branch_id });
    if (ketQua.error) {
      return res.status(400).json({ message: ketQua.error });
    }
    return res.status(200).json(ketQua);
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi tính phí giao hàng!', error: error.message });
  }
};

/**
 * 🌟 ĐÃ CẬP NHẬT: ĐẶT ĐƠN HÀNG ONLINE (KÈM CHẶN 1 LẦN DÙNG/TÀI KHOẢN VÀ TRỪ SỐ LƯỢNG AN TOÀN)
 */
const datDonHang = async (req, res) => {
  try {
    const {
      user_id,
      branch_id, 
      items,
      payment_method,
      customer_cash,
      delivery,
      promotion_code, 
    } = req.body;

    if (!user_id) {
      return res.status(400).json({ message: 'Thiếu mã khách hàng!' });
    }
    if (!items?.length) {
      return res.status(400).json({ message: 'Giỏ hàng trống, không thể đặt!' });
    }
    const normalizedPaymentMethod = payment_method === 'QR_CODE' ? 'PAYOS' : payment_method;

    if (!['CASH', 'PAYOS'].includes(normalizedPaymentMethod)) {
      return res.status(400).json({ message: 'Phương thức thanh toán không hợp lệ!' });
    }
    if (normalizedPaymentMethod === 'PAYOS') {
      return res.status(400).json({
        message: 'Thanh toán payOS phải tạo mã QR trước. Đơn hàng chỉ được lưu sau khi thanh toán thành công!',
      });
    }
    if (!delivery?.address_detail?.trim()) {
      return res.status(400).json({ message: 'Thiếu địa chỉ nhận hàng!' });
    }

    const user = await User.findById(user_id);
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy tài khoản!' });
    }
    if (Number(user.role_id) !== 3) {
      return res.status(403).json({ message: 'Chỉ khách hàng mới được đặt hàng online!' });
    }

    const phiShip = await tinhPhiGiaoHang({
      latitude: delivery.latitude,
      longitude: delivery.longitude,
      branch_id: branch_id || req.body.branchId || req.body.idChiNhanhChon
    });

    if (phiShip.error) {
      return res.status(400).json({ message: phiShip.error });
    }
    if (!phiShip.within_range) {
      return res.status(400).json({
        message: `Địa chỉ giao hàng quá xa cửa hàng (${phiShip.distance_km} km). Chỉ giao trong bán kính ${phiShip.max_distance_km} km!`,
        ...phiShip,
      });
    }
    if (!phiShip.branch_id) {
      return res.status(400).json({ message: 'Không xác định được chi nhánh giao hàng!' });
    }

    const orderItems = [];
    let products_subtotal = 0;

    for (const item of items) {
      const quantity = Math.max(1, Number(item.quantity) || 1);
      const final_unit_price = Number(item.final_unit_price ?? item.donGia) || 0;
      const subtotal = Number(item.subtotal ?? item.tongTien) || final_unit_price * quantity;
      const product_name = item.product_name || item.tenMon || 'Sản phẩm';
      const base_price = Number(item.base_price) || final_unit_price;
      const selected_toppings = (item.selected_toppings || item.toppings || []).map((t) => ({
        topping_name: t.topping_name,
        price: Number(t.price) || 0,
      }));

      const product_id = await resolveProductId(item.product_id || item.productId, product_name);

      orderItems.push({
        product_id,
        product_name,
        base_price,
        quantity,
        selected_toppings,
        final_unit_price,
        subtotal,
      });
      products_subtotal += subtotal;
    }

    let discount_amount = 0;
    let validPromotion = null;
    let userPromotionRecord = null; // Lưu vết bản ghi ví để backup nếu tạo đơn lỗi

    // ================= XỬ LÝ ÁP DỤNG VÀ TRỪ SỐ LƯỢNG MÃ GIẢM GIÁ =================
    if (promotion_code && mongoose.Types.ObjectId.isValid(String(promotion_code))) {
      validPromotion = await Promotion.findById(promotion_code);
      
      if (!validPromotion) {
        return res.status(400).json({ message: 'Mã giảm giá không tồn tại trên hệ thống!' });
      }

      const bayGio = new Date();
      if (validPromotion.is_active === false || validPromotion.status === 'inactive') {
        return res.status(400).json({ message: 'Mã ưu đãi này đã bị tạm ngưng áp dụng hoặc không hoạt động!' });
      }
      if (validPromotion.start_date && bayGio < new Date(validPromotion.start_date)) {
        return res.status(400).json({ message: 'Mã ưu đãi này chưa đến thời gian kích hoạt sử dụng!' });
      }
      if (validPromotion.end_date && bayGio > new Date(validPromotion.end_date)) {
        return res.status(400).json({ message: 'Mã giảm giá này đã hết hạn sử dụng!' });
      }

      // 1. Chặn: Kiểm tra tài khoản đã sử dụng mã này cho đơn hàng khác trước đây chưa
      const daSuDungMao = await UserPromotion.findOne({ 
        user_id: user._id, 
        promotion_id: validPromotion._id, 
        status: 'used' 
      });
      if (daSuDungMao) {
        return res.status(400).json({ message: 'Tài khoản của bạn đã sử dụng mã giảm giá này rồi!' });
      }

      // 2. Xử lý trừ số lượng theo từng loại mã riêng biệt
      if (validPromotion.promotion_type === 'public') {
        
        // LOẠI A: MÃ PUBLIC (Kiểm tra kho tổng và cộng dồn đếm số lượng an toàn bằng Atomic)
        const updatePublicPromo = await Promotion.findOneAndUpdate(
          {
            _id: validPromotion._id,
            promotion_type: 'public',
            is_active: true,
            $or: [
              { usage_limit: null },
              { $expr: { $lt: ["$claimed_count", "$usage_limit"] } }
            ]
          },
          { $inc: { claimed_count: 1 } },
          { new: true }
        );

        if (!updatePublicPromo) {
          return res.status(400).json({ message: 'Mã giảm giá này vừa mới hết lượt sử dụng trên hệ thống!' });
        }

        // Tạo bản ghi lưu vết đã dùng mã Public (Bắt lỗi index unique chặn đứng spam click)
        try {
          userPromotionRecord = await UserPromotion.create({
            user_id: user._id,
            promotion_id: validPromotion._id,
            status: 'used',
            claimed_at: bayGio,
            used_at: bayGio
          });
        } catch (dbErr) {
          // Hoàn trả lại số lượng kho tổng nếu lỗi trùng lặp index unique (User bấm thanh toán cùng một giây)
          await Promotion.findByIdAndUpdate(validPromotion._id, { $inc: { claimed_count: -1 } });
          if (dbErr.code === 11000) {
            return res.status(400).json({ message: 'Bạn đang thao tác quá nhanh hoặc đã dùng mã này rồi!' });
          }
          throw dbErr;
        }

      } else if (validPromotion.promotion_type === 'collectible') {
        
        // LOẠI B: MÃ COLLECTIBLE (Vì số lượng đã trừ lúc nhận vào ví, giờ chỉ cần đổi trạng thái ví)
        userPromotionRecord = await UserPromotion.findOneAndUpdate(
          { 
            user_id: user._id, 
            promotion_id: validPromotion._id, 
            status: 'claimed' // Chỉ chấp nhận mã đang trong ví chưa xài
          },
          { 
            $set: { status: 'used', used_at: bayGio } 
          }
        );

        if (!userPromotionRecord) {
          return res.status(400).json({ message: 'Mã ưu đãi không có sẵn trong ví của bạn hoặc đã bị sử dụng!' });
        }
      }

      discount_amount = Math.min(products_subtotal, Number(validPromotion.discount_value) || 0);
    }
    // =============================================================================

    const shipping_fee = phiShip.shipping_fee;
    const total_amount = Math.max(0, products_subtotal - discount_amount + shipping_fee);

    let cash_details = { customer_cash: 0, change_due: 0 };
    if (normalizedPaymentMethod === 'CASH') {
      const tienKhachTra = Number(customer_cash) || 0;
      if (tienKhachTra < total_amount) {
        // Cần hoàn tác mã khuyến mãi nếu dữ liệu đơn hàng lỗi chặn đứng
        if (validPromotion) await rollBackPromotion(user._id, validPromotion, userPromotionRecord);
        return res.status(400).json({
          message: `Số tiền khách trả (${tienKhachTra.toLocaleString('vi-VN')}đ) phải lớn hơn hoặc bằng tổng thanh toán (${total_amount.toLocaleString('vi-VN')}đ)!`,
        });
      }
      cash_details = {
        customer_cash: tienKhachTra,
        change_due: tienKhachTra - total_amount,
      };
    }

    const customer_name = delivery.customer_name?.trim() || user.full_name;
    const phone = delivery.phone?.trim() || user.phone || '';

    try {
      let order = await Order.create({
        order_type: 'online',
        customer_id: user._id,
        branch_id: phiShip.branch_id,
        items: orderItems,
        products_subtotal,
        shipping_fee,
        distance_km: phiShip.distance_km,
        promotion_code: validPromotion ? validPromotion._id : null, 
        discount_amount, 
        total_amount,
        payment_method: normalizedPaymentMethod,
        payment_status: normalizedPaymentMethod === 'PAYOS' ? 'PENDING' : 'UNPAID',
        cash_details,
        shipping_address: {
          address_detail: delivery.address_detail.trim(),
          customer_name,
          phone,
          latitude: Number(delivery.latitude) || 0,
          longitude: Number(delivery.longitude) || 0,
        },
        status: 'pending',
        status_history: [
          {
            status: 'pending',
            updated_at: new Date(),
            reason: 'Khách đặt hàng online — Đã đặt',
          },
        ],
      });

      order = await Order.findById(order._id).populate('branch_id', 'branch_name shop_address');

      return res.status(201).json({
        message: 'Đặt hàng thành công!',
        order,
      });

    } catch (createOrderError) {
      // HOÀN TÁC MÃ KHUYẾN MÃI NẾU QUÁ TRÌNH TẠO ĐƠN HÀNG LỖI CƠ SỞ DỮ LIỆU
      if (validPromotion) await rollBackPromotion(user._id, validPromotion, userPromotionRecord);
      throw createOrderError;
    }

  } catch (error) {
    return res.status(500).json({ message: error.message || 'Lỗi đặt hàng!', error: error.message });
  }
};

/**
 * HÀM TRỢ GIÚP HOÀN TÁC VOUCHER NẾU QUÁ TRÌNH LƯU ĐƠN HÀNG THẤT BẠI
 */
const rollBackPromotion = async (userId, promotion, originalRecord) => {
  if (promotion.promotion_type === 'public') {
    await Promotion.findByIdAndUpdate(promotion._id, { $inc: { claimed_count: -1 } });
    await UserPromotion.deleteOne({ user_id: userId, promotion_id: promotion._id, status: 'used' });
  } else if (promotion.promotion_type === 'collectible' && originalRecord) {
    await UserPromotion.findOneAndUpdate(
      { user_id: userId, promotion_id: promotion._id, status: 'used' },
      { $set: { status: 'claimed' }, $unset: { used_at: "" } }
    );
  }
};

/**
 * 🌟 ĐÃ CẬP NHẬT HOÀN TOÀN: ĐỒNG BỘ POPULATE MẠNH MẼ CHO KHÁCH HÀNG
 */
const layDonHangCuaKhach = async (req, res) => {
  try {
    const { user_id } = req.query;
    if (!user_id) {
      return res.status(400).json({ message: 'Thiếu mã khách hàng!' });
    }

    const rawOrders = await Order.find({
      customer_id: user_id,
      order_type: 'online',
    })
      .populate('branch_id', 'branch_name shop_address') 
      .sort({ createdAt: -1 })
      .lean();

    const completedOrderIds = rawOrders
      .filter(o => o.status === 'completed')
      .map(o => o._id);

    const reviews = await Review.find({
      user_id: user_id,
      order_id: { $in: completedOrderIds }
    }).lean();

    const reviewMap = new Map();
    reviews.forEach(r => {
      if (r.order_id && r.product_id) {
        const key = `${r.order_id.toString()}_${r.product_id.toString()}`;
        reviewMap.set(key, r);
      }
    });

    const statusMap = {
      pending: { label: 'Chờ duyệt', className: 'khdh-status-pending' },
      preparing: { label: 'Đang chuẩn bị', className: 'khdh-status-preparing' },
      ready: { label: 'Món đã sẵn sàng', className: 'khdh-status-ready' },
      shipping: { label: 'Đang giao hàng', className: 'khdh-status-shipping' },
      completed: { label: 'Đã hoàn thành', className: 'khdh-status-completed' },
      failed: { label: 'Thất bại', className: 'khdh-status-failed' },
      cancelled: { label: 'Đã hủy đơn', className: 'khdh-status-cancelled' },
    };

    const orders = rawOrders.map((order) => {
      const currentConfig = statusMap[order.status] || {
        label: order.status, 
        className: 'khdh-status-unknown',
      };

      const historyWithLabels = (order.status_history || []).map((h) => ({
        ...h,
        status_label: statusMap[h.status]?.label || h.status,
      }));

      let updatedItems = order.items || [];
      if (order.status === 'completed' && order.items) {
        updatedItems = order.items.map(item => {
          if (item.product_id) {
            const searchKey = `${order._id.toString()}_${item.product_id.toString()}`;
            const matchedReview = reviewMap.get(searchKey);

            if (matchedReview) {
              return {
                ...item,
                is_reviewed: true,
                my_review: {
                  rating: matchedReview.rating,
                  comment_text: matchedReview.comment_text
                }
              };
            }
          }
          return {
            ...item,
            is_reviewed: false,
            my_review: null
          };
        });
      }

      return {
        ...order,
        items: updatedItems,
        status_detail: currentConfig, 
        status_history: historyWithLabels
      };
    });

    return res.status(200).json({ orders });
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi tải đơn hàng!', error: error.message });
  }
};

/**
 * 🌟 ĐÃ CẬP NHẬT: HỦY ĐƠN HÀNG (HOÀN TRẢ SỐ LƯỢNG CHO TÀI KHOẢN KHÁC SỬ DỤNG)
 */
const huyDonHang = async (req, res) => {
  try {
    const { user_id, order_id, reason } = req.body;

    if (!user_id || !order_id) {
      return res.status(400).json({ message: 'Thiếu thông tin đơn hàng!' });
    }

    const order = await Order.findById(order_id);
    if (!order) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng!' });
    }

    if (!order.customer_id || order.customer_id.toString() !== user_id) {
      return res.status(403).json({ message: 'Bạn không có quyền hủy đơn này!' });
    }

    if (order.status === 'cancelled') {
      return res.status(400).json({ message: 'Đơn hàng đã được hủy trước đó!' });
    }

    if (!['pending', 'preparing'].includes(order.status)) {
      return res.status(400).json({
        message: 'Chỉ có thể hủy đơn khi trạng thái là "Chờ duyệt" hoặc "Đang chuẩn bị"!',
      });
    }

    order.status = 'cancelled';
    order.status_history.push({
      status: 'cancelled',
      reason: reason?.trim() || 'Khách hàng yêu cầu hủy đơn',
      updated_at: new Date(),
    });
    await order.save();

    // ================= XỬ LÝ HOÀN TRẢ SỐ LƯỢNG KHI HỦY ĐƠN =================
    if (order.promotion_code) {
      const promotion = await Promotion.findById(order.promotion_code);
      
      if (promotion) {
        if (promotion.promotion_type === 'public') {
          // Mã public: Giảm 1 ở kho tổng hệ thống để người khác có thể sử dụng
          await Promotion.findByIdAndUpdate(promotion._id, { $inc: { claimed_count: -1 } });
          // Xóa vết sử dụng để tài khoản này sau này có thể dùng lại mã public đó
          await UserPromotion.deleteOne({ user_id: user_id, promotion_id: promotion._id, status: 'used' });
        
        } else if (promotion.promotion_type === 'collectible') {
          // Mã collectible: Trả lại trạng thái 'claimed' vào ví của họ để họ dùng cho đơn khác
          await UserPromotion.findOneAndUpdate(
            { user_id: user_id, promotion_id: promotion._id, status: 'used' },
            { $set: { status: 'claimed' }, $unset: { used_at: "" } }
          );
          // Lưu ý: Số lượng kho tổng không đổi vì mã vẫn nằm trong ví của họ (tài khoản khác không lấy được)
        }
      }
    }
    // =======================================================================

    return res.status(200).json({
      message: 'Hủy đơn hàng thành công và hoàn trả mã khuyến mãi!',
      order,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi hủy đơn hàng!', error: error.message });
  }
};

module.exports = { layDonHangCuaKhach, huyDonHang, datDonHang, tinhPhiShip, getAllShippingConfigs };
