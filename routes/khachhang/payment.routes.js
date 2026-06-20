const express = require('express');
const mongoose = require('mongoose');
const Order = require('../../models/Order');
const Payment = require('../../models/Payment');
const Product = require('../../models/Product');
const User = require('../../models/User');
const { tinhPhiGiaoHang } = require('../../utils/cuaHang');
const {
  createPaymentLink,
  getPaymentLinkStatus,
  makeOrderCode,
  normalizeDescription,
  verifyWebhook,
} = require('../../services/payos.service');

const router = express.Router();

function mapPayOSStatus(status, success) {
  if (success === true || status === 'PAID') return 'PAID';
  if (status === 'CANCELLED') return 'CANCELLED';
  if (status === 'FAILED' || status === 'EXPIRED') return 'FAILED';
  return 'PENDING';
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

async function buildOrderDraft({ user_id, branch_id, items, delivery, discount_amount }) { // 🌟 1. ĐÃ THÊM discount_amount vào tham số nhận vào
  if (!user_id) {
    const error = new Error('Thiếu mã khách hàng!');
    error.statusCode = 400;
    throw error;
  }
  if (!branch_id) {
    const error = new Error('Vui lòng chọn chi nhánh phục vụ!');
    error.statusCode = 400;
    throw error;
  }
  if (!items?.length) {
    const error = new Error('Giỏ hàng trống, không thể thanh toán!');
    error.statusCode = 400;
    throw error;
  }
  if (!delivery?.address_detail?.trim()) {
    const error = new Error('Thiếu địa chỉ nhận hàng!');
    error.statusCode = 400;
    throw error;
  }

  const user = await User.findById(user_id);
  if (!user) {
    const error = new Error('Không tìm thấy tài khoản!');
    error.statusCode = 404;
    throw error;
  }
  if (Number(user.role_id) !== 3) {
    const error = new Error('Chỉ khách hàng mới được đặt hàng online!');
    error.statusCode = 403;
    throw error;
  }

  // Chuẩn hóa và làm sạch số điện thoại từ DB
  let phone = user.phone || '';
  phone = String(phone).replace(/[\s\+\-]/g, ''); 

  if (!phone || phone.trim() === '' || phone.length < 10) {
    const error = new Error('Tài khoản của bạn chưa cập nhật số điện thoại hợp lệ. Vui lòng bổ sung trong mục Hồ sơ để mua hàng!');
    error.statusCode = 400;
    throw error;
  }

  const phiShip = await tinhPhiGiaoHang({
    latitude: delivery.latitude,
    longitude: delivery.longitude,
    branch_id: branch_id,
  });
  if (phiShip.error) {
    const error = new Error(phiShip.error);
    error.statusCode = 400;
    throw error;
  }
  if (!phiShip.within_range) {
    const error = new Error(`Địa chỉ giao hàng quá xa cửa hàng (${phiShip.distance_km} km). Chỉ giao trong bán kính ${phiShip.max_distance_km} km!`);
    error.statusCode = 400;
    throw error;
  }
  if (!phiShip.branch_id) {
    const error = new Error('Không xác định được chi nhánh giao hàng!');
    error.statusCode = 400;
    throw error;
  }

  const orderItems = [];
  let products_subtotal = 0;

  for (const item of items) {
    const quantity = Math.max(1, Number(item.quantity) || 1);
    const final_unit_price = Number(item.final_unit_price ?? item.donGia ?? item.price) || 0;
    const subtotal = Number(item.subtotal ?? item.tongTien) || final_unit_price * quantity;
    const product_name = item.product_name || item.tenMon || item.name || 'Sản phẩm';
    
    // 🌟 ĐÃ XÓA dòng ép kiểu discount ở đây (sai vị trí scope)

    const selected_toppings = (item.selected_toppings || item.toppings || []).map((t) => ({
      topping_name: t.topping_name,
      price: Number(t.price) || 0,
    }));
    const toppingTotal = selected_toppings.reduce((sum, topping) => sum + Number(topping.price || 0), 0);
    const base_price = Number(item.base_price) || Math.max(0, final_unit_price - toppingTotal);
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

  const shipping_fee = phiShip.shipping_fee;
  
  // 🌟 2. ĐÃ CHUYỂN RA NGOÀI VÒNG LẶP: Ép kiểu chuẩn xác cho số tiền giảm giá
  const discount = Number(discount_amount) || 0;

  // 🌟 3. ĐÃ CẬP NHẬT: Tổng tiền = Tiền hàng + Ship - Giảm giá (Dùng Math.max để tránh tiền bị âm)
  const total_amount = Math.max(0, products_subtotal + shipping_fee - discount);
  
  const customer_name = delivery.customer_name?.trim() || user.full_name;

  return {
    orderData: {
      order_type: 'online',
      customer_id: user._id,
      branch_id: phiShip.branch_id,
      items: orderItems,
      products_subtotal,
      shipping_fee,
      distance_km: phiShip.distance_km,
      discount_amount: discount, // 🌟 Nhận giá trị chuẩn
      total_amount,               // 🌟 Số tiền chính xác đã trừ giảm giá
      payment_method: 'PAYOS',
      payment_status: 'PENDING',
      cash_details: { customer_cash: 0, change_due: 0 },
      shipping_address: {
        address_detail: delivery.address_detail.trim(),
        customer_name,
        phone: phone.trim(),
        latitude: Number(delivery.latitude) || 0,
        longitude: Number(delivery.longitude) || 0,
      },
      status: 'pending',
      status_history: [
        {
          status: 'pending',
          updated_at: new Date(),
          reason: 'Khách thanh toán payOS thành công - Đã đặt',
        },
      ],
    },
    paymentItems: orderItems.slice(0, 10).map((item) => ({
      name: String(item.product_name || 'MilkTea').slice(0, 50),
      quantity: item.quantity,
      price: item.final_unit_price,
    })),
    buyer: {
      name: customer_name.normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
      phone: phone.trim(),
      email: user.email || '',
    },
  };
}
async function finalizePaidPayment(payment) {
  if (!payment) return null;

  if (payment.order_id) {
    await Order.findByIdAndUpdate(payment.order_id, {
      payment_status: 'PAID',
      payos_order_code: payment.order_code,
      payos_payment_link_id: payment.payment_link_id,
    });
    return payment.order_id;
  }

  if (!payment.order_payload) return null;

  const order = await Order.create({
    ...payment.order_payload,
    payment_status: 'PAID',
    payos_order_code: payment.order_code,
    payos_payment_link_id: payment.payment_link_id,
  });

  payment.order_id = order._id;
  payment.paid_at = payment.paid_at || new Date();
  await payment.save();

  return order._id;
}

// ✔️ ĐÃ CẬP NHẬT: Hàm cắt bỏ các đoạn chuỗi thừa hệ thống ngân hàng (.CT tu...)
function cleanBankDescription(desc) {
  if (!desc) return null;

  // Tìm vị trí của dấu chấm "." (nơi bắt đầu của phần đuôi thừa)
  const dotIndex = desc.indexOf('.');
  if (dotIndex !== -1) {
    return desc.substring(0, dotIndex).trim();
  }

  return desc.trim();
}

async function updatePaymentAndOrder({ orderCode, paymentLinkId, status, rawWebhookData, apiData }) {
  const normalizedStatus = mapPayOSStatus(status);
  const payment = await Payment.findOne({
    $or: [
      ...(orderCode ? [{ order_code: Number(orderCode) }] : []),
      ...(paymentLinkId ? [{ payment_link_id: paymentLinkId }] : []),
    ],
  });

  if (!payment) return null;

  payment.status = normalizedStatus;
  if (paymentLinkId) payment.payment_link_id = paymentLinkId;

  // 🌟 Hứng trọn dữ liệu đổ về từ Webhook (Môi trường Live/Test)
  if (rawWebhookData && rawWebhookData.data) {
    payment.raw_webhook_data = rawWebhookData;
    const webhookData = rawWebhookData.data;
    
    payment.bank_account_name = webhookData.counterAccountName || payment.bank_account_name;
    payment.bank_account_number = webhookData.counterAccountNumber || payment.bank_account_number; 
    payment.bank_description = cleanBankDescription(webhookData.description) || payment.bank_description; // 🌟 ĐÃ CẬP NHẬT: Loại bỏ đuôi rác ngân hàng
    payment.bank_amount_paid = Number(webhookData.amount) || payment.bank_amount_paid;
    payment.bank_reference = webhookData.reference || payment.bank_reference;
  }

  // 🌟 Hứng dữ liệu dự phòng từ API Check Status cám biệt
  if (apiData) {
    payment.bank_amount_paid = Number(apiData.amountPaid) || payment.bank_amount_paid;
    
    // Nếu API có đính kèm lịch sử mảng giao dịch thanh toán
    const transaction = apiData.transactions?.[0];
    if (transaction) {
      payment.bank_account_name = transaction.counterAccountName || transaction.accountName || payment.bank_account_name;
      payment.bank_account_number = transaction.counterAccountNumber || payment.bank_account_number; 
      payment.bank_description = cleanBankDescription(transaction.description) || payment.bank_description; // 🌟 ĐÃ CẬP NHẬT: Loại bỏ đuôi rác ngân hàng
      payment.bank_reference = transaction.reference || payment.bank_reference;
    }
  }

  if (normalizedStatus === 'PAID' && !payment.paid_at) payment.paid_at = new Date();
  await payment.save();

  if (normalizedStatus === 'PAID') {
    await finalizePaidPayment(payment);
  } else if (payment.order_id) {
    const orderPaymentStatus = normalizedStatus === 'CANCELLED'
      ? 'CANCELLED'
      : normalizedStatus === 'FAILED'
        ? 'FAILED'
        : 'PENDING';

    await Order.findByIdAndUpdate(payment.order_id, {
      payment_status: orderPaymentStatus,
      payos_order_code: payment.order_code,
      payos_payment_link_id: payment.payment_link_id,
    });
  }

  return payment;
}

function buildPayOSItemsFromOrderPayload(orderPayload) {
  return (orderPayload?.items || []).slice(0, 10).map((item) => ({
    name: String(item.product_name || 'MilkTea').slice(0, 50),
    quantity: Math.max(1, Number(item.quantity) || 1),
    price: Math.max(0, Number(item.final_unit_price || item.subtotal) || 0),
  }));
}

async function createRetryPayment(oldPayment) {
  let order = null;
  let orderPayload = oldPayment.order_payload;
  let amount = Number(oldPayment.amount) || 0;
  let paymentItems = buildPayOSItemsFromOrderPayload(orderPayload);
  let buyerName = orderPayload?.shipping_address?.customer_name || '';
  let buyerPhone = orderPayload?.shipping_address?.phone || '';
  let buyerEmail = '';

  if (oldPayment.order_id) {
    order = await Order.findById(oldPayment.order_id);
    if (!order) {
      const error = new Error('Không tìm thấy đơn hàng cần thanh toán lại!');
      error.statusCode = 404;
      throw error;
    }

    amount = Number(order.total_amount);
    paymentItems = order.items.slice(0, 10).map((item) => ({
      name: String(item.product_name || 'MilkTea').slice(0, 50),
      quantity: Math.max(1, Number(item.quantity) || 1),
      price: Math.max(0, Number(item.final_unit_price || item.subtotal) || 0),
    }));
    buyerName = order.shipping_address?.customer_name || '';
    buyerPhone = order.shipping_address?.phone || '';
  }

  if (!order && !orderPayload) {
    const error = new Error('Không còn dữ liệu đơn hàng tạm để tạo lại mã QR!');
    error.statusCode = 400;
    throw error;
  }

  const userId = oldPayment.user_id || order?.customer_id || orderPayload?.customer_id;
  if (userId) {
    const user = await User.findById(userId).lean();
    let cleanPhone = String(user?.phone || '').replace(/[\s\+\-]/g, '');
    
    if (!user || !cleanPhone || cleanPhone.trim() === '') {
      const error = new Error('Tài khoản chưa cập nhật số điện thoại. Không thể tạo liên kết thanh toán!');
      error.statusCode = 400;
      throw error;
    }
    buyerEmail = user?.email || '';
    buyerPhone = cleanPhone.trim();
  }

  const orderCode = makeOrderCode(order?._id);
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const paymentLink = await createPaymentLink({
    orderCode,
    amount,
    description: normalizeDescription(`MilkTea DH${String(orderCode).slice(-6)}`, orderCode),
    items: paymentItems,
    buyerName: buyerName.normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
    buyerPhone,
    buyerEmail,
    returnUrl: `${frontendUrl}/payos-return`,
    cancelUrl: `${frontendUrl}/payos-cancel`,
  });

  oldPayment.status = oldPayment.status === 'PAID' ? 'PAID' : 'CANCELLED';
  await oldPayment.save();

  const newPayment = await Payment.create({
    order_id: order?._id || null,
    user_id: userId || null,
    order_code: orderCode,
    method: 'PAYOS',
    amount,
    status: 'PENDING',
    payment_link_id: paymentLink.paymentLinkId,
    checkout_url: paymentLink.checkoutUrl,
    qr_code: paymentLink.qrCode,
    order_payload: order ? null : orderPayload,
  });

  if (order) {
    order.payment_method = 'PAYOS';
    order.payment_status = 'PENDING';
    order.payos_order_code = orderCode;
    order.payos_payment_link_id = paymentLink.paymentLinkId;
    if (order.shipping_address) order.shipping_address.phone = buyerPhone;
    await order.save();
  }

  return newPayment;
}

router.post('/payos/create', async (req, res) => {
  try {
    const {
      user_id,
      order_id,
      orderCode: requestedOrderCode,
      amount,
      description,
      items,
      buyerName,
      buyerPhone,
      buyerEmail,
      delivery,
      discount_amount, // 🌟 1. ĐÃ BỔ SUNG: Nhặt lấy số tiền giảm từ req.body do Frontend gửi lên
    } = req.body;

    let order = null;
    let orderDraft = null;
    let paymentAmount = Number(amount) || 0;
    let paymentItems = [];
    let buyer = {
      name: buyerName || '',
      phone: buyerPhone || '',
      email: buyerEmail || '',
    };

    if (order_id) {
      if (!mongoose.Types.ObjectId.isValid(String(order_id))) {
        return res.status(400).json({ message: 'Thiếu mã đơn hàng hợp lệ!' });
      }

      order = await Order.findById(order_id);
      if (!order) {
        return res.status(404).json({ message: 'Không tìm thấy đơn hàng!' });
      }
      if (user_id && order.customer_id?.toString() !== String(user_id)) {
        return res.status(403).json({ message: 'Bạn không có quyền thanh toán đơn hàng này!' });
      }

      const customerId = order.customer_id || user_id;
      const associatedUser = await User.findById(customerId);
      let cleanPhone = String(associatedUser?.phone || '').replace(/[\s\+\-]/g, '');

      if (!associatedUser || !cleanPhone || cleanPhone.trim() === '') {
        return res.status(400).json({ message: 'Tài khoản chưa cập nhật số điện thoại để thanh toán đơn hàng này!' });
      }

      paymentAmount = paymentAmount || Number(order.total_amount);
      
      // 🌟 2. ĐÃ SỬA: Quy về 1 Item tổng của đơn hàng cũ để PayOS không bắt lỗi lệch tiền (Price * Qty)
      paymentItems = [{
        name: `Thanh toan don hang MilkTea #${order_id.toString().slice(-4)}`,
        quantity: 1,
        price: paymentAmount,
      }];

      buyer = {
        name: (buyer.name || order.shipping_address?.customer_name || associatedUser.full_name).normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
        phone: cleanPhone.trim(),
        email: buyer.email || associatedUser.email || '',
      };
    } else {
      // 🌟 3. ĐÃ CẬP NHẬT: Truyền discount_amount vào hàm dựng đơn hàng tạm
      const draft = await buildOrderDraft({ 
        user_id, 
        branch_id: req.body.branch_id, 
        items, 
        delivery, 
        discount_amount: Number(discount_amount) || 0 // Ép kiểu số chuẩn chỉnh
      });

      orderDraft = draft.orderData;
      paymentAmount = orderDraft.total_amount; // Lúc này total_amount đã được trừ discount chính xác!
      
      // 🌟 4. ĐÃ SỬA: Quy về 1 Item tổng cho đơn hàng mới để PayOS đối soát khớp 100% với paymentAmount
      paymentItems = [{
        name: `Thanh toan don hang MilkTea`,
        quantity: 1,
        price: paymentAmount, // Số tiền hiển thị thẳng trên hóa đơn QR PayOS (38.637đ)
      }];

      buyer = {
        name: draft.buyer.name,
        phone: draft.buyer.phone,
        email: buyer.email || draft.buyer.email,
      };
    }

    if (!paymentAmount || paymentAmount <= 0) {
      return res.status(400).json({ message: 'Số tiền thanh toán không hợp lệ!' });
    }

    const existingPayment = order
      ? await Payment.findOne({ order_id: order._id, status: { $in: ['PENDING', 'PAID'] } })
      : null;
    if (existingPayment?.checkout_url) {
      return res.status(200).json({
        checkoutUrl: existingPayment.checkout_url,
        qrCode: existingPayment.qr_code,
        orderCode: existingPayment.order_code,
        paymentLinkId: existingPayment.payment_link_id,
        status: existingPayment.status,
      });
    }

    const orderCode = makeOrderCode(order?._id, requestedOrderCode);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const paymentLink = await createPaymentLink({
      orderCode,
      amount: paymentAmount,
      description: normalizeDescription(description, orderCode),
      items: paymentItems,
      buyerName: buyer.name,
      buyerPhone: buyer.phone,
      buyerEmail: buyer.email,
      returnUrl: `${frontendUrl}/payos-return`,
      cancelUrl: `${frontendUrl}/payos-cancel`,
    });

    const payment = await Payment.create({
      order_id: order?._id || null,
      user_id: order?.customer_id || user_id,
      order_code: orderCode,
      method: 'PAYOS',
      amount: paymentAmount,
      status: 'PENDING',
      payment_link_id: paymentLink.paymentLinkId,
      checkout_url: paymentLink.checkoutUrl,
      qr_code: paymentLink.qrCode,
      order_payload: orderDraft,
    });

    if (order) {
      order.payment_method = 'PAYOS';
      order.payment_status = 'PENDING';
      order.payos_order_code = orderCode;
      order.payos_payment_link_id = paymentLink.paymentLinkId;
      await order.save();
    }

    return res.status(201).json({
      checkoutUrl: payment.checkout_url,
      qrCode: payment.qr_code,
      orderCode: payment.order_code,
      paymentLinkId: payment.payment_link_id,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.statusCode
        ? error.message
        : 'Không tạo được mã QR thanh toán. Vui lòng thử lại hoặc chọn thanh toán khi nhận hàng.',
      error: error.message,
    });
  }
});

router.get('/payos/status', async (req, res) => {
  try {
    const { orderCode, paymentLinkId } = req.query;
    if (!orderCode && !paymentLinkId) {
      return res.status(400).json({ message: 'Thiếu orderCode hoặc paymentLinkId!' });
    }

    const paymentLink = await getPaymentLinkStatus({ orderCode, paymentLinkId });
    const payment = await updatePaymentAndOrder({
      orderCode: paymentLink.orderCode || orderCode,
      paymentLinkId: paymentLink.id || paymentLinkId,
      status: paymentLink.status,
      apiData: paymentLink,
    });

    return res.status(200).json({
      status: payment?.status || mapPayOSStatus(paymentLink.status),
      orderId: payment?.order_id || null,
      checkoutUrl: payment?.checkout_url || null,
      orderCode: paymentLink.orderCode || Number(orderCode),
      paymentLinkId: paymentLink.id || paymentLinkId,
      amountPaid: paymentLink.amountPaid,
      amountRemaining: paymentLink.amountRemaining,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Không kiểm tra được trạng thái thanh toán!', error: error.message });
  }
});

router.post('/payos/retry', async (req, res) => {
  try {
    const { orderCode, paymentLinkId } = req.body;
    if (!orderCode && !paymentLinkId) {
      return res.status(400).json({ message: 'Thiếu orderCode hoặc paymentLinkId!' });
    }

    const oldPayment = await Payment.findOne({
      $or: [
        ...(orderCode ? [{ order_code: Number(orderCode) }] : []),
        ...(paymentLinkId ? [{ payment_link_id: paymentLinkId }] : []),
      ],
    });
    if (!oldPayment) {
      return res.status(404).json({ message: 'Không tìm thấy phiên thanh toán cũ!' });
    }

    try {
      const paymentLink = await getPaymentLinkStatus({
        orderCode: oldPayment.order_code,
        paymentLinkId: oldPayment.payment_link_id,
      });
      await updatePaymentAndOrder({
        orderCode: paymentLink.orderCode || oldPayment.order_code,
        paymentLinkId: paymentLink.id || oldPayment.payment_link_id,
        status: paymentLink.status,
        apiData: paymentLink,
      });
    } catch (_) {}

    const refreshedPayment = await Payment.findById(oldPayment._id);
    if (refreshedPayment.status === 'PAID') {
      return res.status(409).json({
        message: 'Đơn hàng này đã thanh toán thành công.',
        status: 'PAID',
        orderId: refreshedPayment.order_id,
      });
    }

    const newPayment = await createRetryPayment(refreshedPayment);
    return res.status(201).json({
      checkoutUrl: newPayment.checkout_url,
      qrCode: newPayment.qr_code,
      orderCode: newPayment.order_code,
      paymentLinkId: newPayment.payment_link_id,
      status: newPayment.status,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.statusCode
        ? error.message
        : 'Không tạo lại được mã QR thanh toán. Vui lòng đặt hàng lại.',
      error: error.message,
    });
  }
});

router.post('/payos/webhook', async (req, res) => {
  try {
    const webhookData = await verifyWebhook(req.body);
    await updatePaymentAndOrder({
      orderCode: webhookData.orderCode,
      paymentLinkId: webhookData.paymentLinkId,
      status: webhookData.code === '00' ? 'PAID' : 'FAILED',
      rawWebhookData: req.body,
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  } 
});

module.exports = router;