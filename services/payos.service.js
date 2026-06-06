const { PayOS } = require('@payos/node');

let payosClient = null;

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable ${name}`);
  }
  return value;
}

function getPayOSClient() {
  if (!payosClient) {
    payosClient = new PayOS({
      clientId: requireEnv('PAYOS_CLIENT_ID'),
      apiKey: requireEnv('PAYOS_API_KEY'),
      checksumKey: requireEnv('PAYOS_CHECKSUM_KEY'),
    });
  }
  return payosClient;
}

function makeOrderCode(orderId, requestedOrderCode) {
  const parsed = Number(requestedOrderCode);
  if (Number.isSafeInteger(parsed) && parsed > 0) return parsed;

  const suffix = orderId
    ? String(orderId).replace(/\D/g, '').slice(-2).padStart(2, '0')
    : String(Math.floor(Math.random() * 100)).padStart(2, '0');
  return Number(`${Date.now()}${suffix}`);
}

function normalizeDescription(description, orderCode) {
  const raw = String(description || `MilkTea DH${orderCode}`).replace(/[^\w\s-]/g, ' ');
  return raw.trim().slice(0, 25) || `MilkTea DH${orderCode}`;
}

async function createPaymentLink(payload) {
  const payos = getPayOSClient();
  return payos.paymentRequests.create(payload);
}

async function verifyWebhook(body) {
  const payos = getPayOSClient();
  return payos.webhooks.verify(body);
}

async function getPaymentLinkStatus({ orderCode, paymentLinkId }) {
  const payos = getPayOSClient();
  if (paymentLinkId) return payos.paymentRequests.get(String(paymentLinkId));
  return payos.paymentRequests.get(Number(orderCode));
}

module.exports = {
  createPaymentLink,
  getPaymentLinkStatus,
  makeOrderCode,
  normalizeDescription,
  verifyWebhook,
};
