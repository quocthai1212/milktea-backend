const mongoose = require('mongoose');
const Order = require('../../models/Order');
const Product = require('../../models/Product');
const User = require('../../models/User');
const Promotion = require('../../models/Promotion'); // 💡 ĐÃ THÊM: Import Model mã giảm giá
const { tinhPhiGiaoHang } = require('../../utils/cuaHang');

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

const tinhPhiShip = async (req, res) => {
  try {
    const { latitude, longitude } = req.query;
    const ketQua = await tinhPhiGiaoHang({ latitude, longitude });
    if (ketQua.error) {
      return res.status(400).json({ message: ketQua.error });
    }
    return res.status(200).json(ketQua);
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi tính phí giao hàng!', error: error.message });
  }
};

const datDonHang = async (req, res) => {
  try {
    const {
      user_id,
      items,
      payment_method,
      customer_cash,
      delivery,
      promotion_code, // 💡 ĐÃ THÊM: Nhận ID mã giảm giá truyền từ Frontend lên
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

    // ==========================================
    // XỬ LÝ MÃ GIẢM GIÁ (PROMOTION)
    // ==========================================
    let discount_amount = 0;
    let validPromotion = null;

    if (promotion_code && mongoose.Types.ObjectId.isValid(String(promotion_code))) {
      validPromotion = await Promotion.findById(promotion_code);
      
      if (!validPromotion) {
        return res.status(400).json({ message: 'Mã giảm giá không tồn tại trên hệ thống!' });
      }

      // Kiểm tra hạn sử dụng
      const bayGio = new Date();
      if (validPromotion.start_date && bayGio < new Date(validPromotion.start_date)) {
        return res.status(400).json({ message: 'Mã ưu đãi này chưa đến thời gian kích hoạt sử dụng!' });
      }
      if (validPromotion.end_date && bayGio > new Date(validPromotion.end_date)) {
        return res.status(400).json({ message: 'Mã giảm giá này đã hết hạn sử dụng!' });
      }

      // Kiểm tra số lượng lượt dùng còn lại
      if (
        validPromotion.usage_limit !== undefined && 
        validPromotion.used_count >= validPromotion.usage_limit
      ) {
        return res.status(400).json({ message: 'Mã giảm giá này đã hết lượt sử dụng!' });
      }

      // Kiểm tra trạng thái hoạt động của mã
      if (validPromotion.status === 'inactive') {
        return res.status(400).json({ message: 'Mã ưu đãi này đã bị tạm ngưng áp dụng!' });
      }

      // Hợp lệ -> Tính toán giá trị giảm giá thực tế (không được vượt quá tổng tiền hàng)
      discount_amount = Math.min(products_subtotal, Number(validPromotion.discount_value) || 0);
    }
    // ==========================================

    const shipping_fee = phiShip.shipping_fee;
    // 💡 ĐÃ CẬP NHẬT: Tổng tiền = Tiền hàng - Giảm giá + Phí giao hàng
    const total_amount = Math.max(0, products_subtotal - discount_amount + shipping_fee);

    let cash_details = { customer_cash: 0, change_due: 0 };
    if (normalizedPaymentMethod === 'CASH') {
      const tienKhachTra = Number(customer_cash) || 0;
      if (tienKhachTra < total_amount) {
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

    // Tiến hành khởi tạo đơn hàng vào cơ sở dữ liệu
    const order = await Order.create({
      order_type: 'online',
      customer_id: user._id,
      items: orderItems,
      products_subtotal,
      shipping_fee,
      distance_km: phiShip.distance_km,
      promotion_code: validPromotion ? validPromotion._id : null, // 💡 ĐÃ LƯU: Foreign Key liên kết mã ưu đãi
      discount_amount, // 💡 ĐÃ LƯU: Số tiền được giảm thực tế
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

    // 💡 ĐÃ CẬP NHẬT: Nếu đơn hàng áp dụng mã giảm giá thành công, tiến hành trừ số lượt dùng xuống
    if (validPromotion) {
      await Promotion.findByIdAndUpdate(validPromotion._id, {
        $inc: { used_count: 1 } // Tăng trường `used_count` lên 1 đơn vị
      });
    }

    return res.status(201).json({
      message: 'Đặt hàng thành công!',
      order,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi đặt hàng!', error: error.message });
  }
};

const layDonHangCuaKhach = async (req, res) => {
  try {
    const { user_id } = req.query;
    if (!user_id) {
      return res.status(400).json({ message: 'Thiếu mã khách hàng!' });
    }

    const orders = await Order.find({
      customer_id: user_id,
      order_type: 'online',
    })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({ orders });
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi tải đơn hàng!', error: error.message });
  }
};

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
        message: 'Chỉ có thể hủy đơn khi trạng thái là "Đã đặt" hoặc "Đang chuẩn bị"!',
      });
    }

    order.status = 'cancelled';
    order.status_history.push({
      status: 'cancelled',
      reason: reason?.trim() || 'Khách hàng yêu cầu hủy đơn',
      updated_at: new Date(),
    });
    await order.save();

    // 💡 ĐÃ BỔ SUNG: Hoàn trả lại 1 lượt dùng mã giảm giá nếu khách hàng hủy đơn hàng ở trạng thái chờ duyệt
    if (order.promotion_code) {
      await Promotion.findByIdAndUpdate(order.promotion_code, {
        $inc: { used_count: -1 } // Giảm used_count đi 1 để hoàn mã cho khách
      });
    }

    return res.status(200).json({
      message: 'Hủy đơn hàng thành công!',
      order,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi hủy đơn hàng!', error: error.message });
  }
};

module.exports = { layDonHangCuaKhach, huyDonHang, datDonHang, tinhPhiShip };