const axios = require('axios');
const crypto = require('crypto');

// Atome Payment API v2 (online integration) — https://doc.apaylater.com/v2/
// Auth is HTTP Basic: username = API Key, password = Password (both issued
// by Atome's onboarding team alongside a separate Merchant ID). Confirmed
// empirically against the real sandbox — Atome's own spec just says
// "username and password issued by your Account Manager" without saying
// which of the three onboarding values plays which role, and Merchant ID
// turned out not to be part of this pair at all (it isn't used anywhere in
// this module — it's a merchant-portal identifier, not an API credential).
// ATOME_ENV switches base URL; anything other than 'production' stays on
// the test endpoint so a missing/typo'd env var can never accidentally hit
// production.
const ATOME_ENV = process.env.ATOME_ENV || 'sandbox';
const BASE_URL =
  ATOME_ENV === 'production' ? 'https://api.apaylater.com/v2' : 'https://api.apaylater.net/v2';

const configured = Boolean(process.env.ATOME_API_KEY && process.env.ATOME_PASSWORD);
if (!configured) {
  console.warn('ATOME_API_KEY/ATOME_PASSWORD not configured — Atome checkout is disabled');
}

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  auth: configured
    ? { username: process.env.ATOME_API_KEY, password: process.env.ATOME_PASSWORD }
    : undefined
});

// Customers only ever type a local 8-digit SG mobile number; Atome requires
// E.164 (e.g. +6591234567). This store is SG-only, so assume +65 when no
// country code is already present.
const toE164 = (mobile) => {
  const trimmed = (mobile || '').replace(/[\s-]/g, '');
  return trimmed.startsWith('+') ? trimmed : `+65${trimmed}`;
};

// Atome's `amount` is a positive integer in the smallest currency unit
// (cents for SGD) — this app stores/display amounts as decimal dollars.
const toCents = (dollars) => Math.round(Number(dollars) * 100);

// Use it to check the configuration on merchant site (POST /auth) — no
// order/payment side effects, just verifies the credentials + connectivity.
const checkConfig = async (callbackUrl) => {
  if (!configured) throw new Error('Atome is not configured');
  const { data } = await client.post('/auth', { countryCode: 'SG', callbackUrl });
  return data;
};

// Creates a new Atome payment/checkout session for an existing pending
// Payment row. `order.order_number` doubles as both `referenceId` (makes
// the call idempotent on Atome's side) and `merchantReferenceId` (shown to
// Atome ops/merchant portal), matching how it's already the customer-facing
// reference for PayNow.
const createCheckout = async ({
  order,
  delivery,
  items,
  customerEmail,
  callbackUrl,
  paymentResultUrl,
  paymentCancelUrl
}) => {
  if (!configured) throw new Error('Atome is not configured');
  const { data } = await client.post('/payments', {
    referenceId: order.order_number,
    merchantReferenceId: order.order_number,
    currency: 'SGD',
    amount: toCents(order.total_price),
    callbackUrl,
    paymentResultUrl,
    paymentCancelUrl,
    customerInfo: {
      mobileNumber: toE164(delivery.contact),
      fullName: `${delivery.first_name} ${delivery.last_name}`.trim(),
      email: customerEmail
    },
    shippingAddress: {
      countryCode: 'SG',
      lines: [delivery.delivery_address],
      postCode: delivery.delivery_postal || ''
    },
    items: items.map((item) => ({
      itemId: String(item.product_id),
      name: item.name,
      quantity: item.quantity,
      price: toCents(item.price)
    }))
  });
  return data; // { referenceId, redirectUrl, appPaymentUrl, status, ... }
};

// Atome's callback only ever carries a `referenceId` — the authoritative
// status must be pulled with this call, never trusted from the callback
// body itself.
const getStatus = async (referenceId) => {
  if (!configured) throw new Error('Atome is not configured');
  const { data } = await client.get(`/payments/${encodeURIComponent(referenceId)}`);
  return data;
};

// Full or partial refund, synchronous. `refundId` is the merchant's own
// idempotency key for this specific refund request (a retried request with
// the same refundId does not double-refund).
const refund = async ({ referenceId, refundId, refundAmount }) => {
  if (!configured) throw new Error('Atome is not configured');
  const { data } = await client.post(`/payments/${encodeURIComponent(referenceId)}/refund`, {
    refundId,
    refundAmount: toCents(refundAmount)
  });
  return data;
};

// Only works before the customer has paid (e.g. an abandoned checkout we
// want Atome to stop treating as live before its 12h default expiry).
const cancel = async (referenceId) => {
  if (!configured) throw new Error('Atome is not configured');
  const { data } = await client.post(`/payments/${encodeURIComponent(referenceId)}/cancel`);
  return data;
};

// HMAC-SHA256 over the raw request body, sent in the X-Signature header —
// per Atome's docs, the secret/scheme for this is only issued on request to
// an Atome account manager, so it isn't part of the standard onboarding
// email and ATOME_WEBHOOK_SECRET may legitimately be unset for a while.
// This is safe to leave unverified in the meantime because the callback
// body carries nothing but a referenceId — a forged callback can only ever
// trigger an extra authenticated getStatus() lookup, never a fake
// completion, since completion is always re-derived from that lookup, not
// from anything in the callback itself.
const verifyWebhookSignature = (rawBody, signatureHeader) => {
  if (!process.env.ATOME_WEBHOOK_SECRET) return true;
  if (!signatureHeader) return false;
  const expected = crypto
    .createHmac('sha256', process.env.ATOME_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');
  const expectedBuf = Buffer.from(expected);
  const gotBuf = Buffer.from(signatureHeader);
  return expectedBuf.length === gotBuf.length && crypto.timingSafeEqual(expectedBuf, gotBuf);
};

// Maps Atome's payment.status to this app's Payment.status enum
// ('pending' | 'completed' | 'failed' | 'refunded').
const mapStatus = (atomeStatus) => {
  switch (atomeStatus) {
    case 'PAID':
      return 'completed';
    case 'REFUNDED':
      return 'refunded';
    case 'FAILED':
    case 'CANCELLED':
      return 'failed';
    default:
      return 'pending'; // PROCESSING
  }
};

module.exports = {
  configured,
  checkConfig,
  createCheckout,
  getStatus,
  refund,
  cancel,
  verifyWebhookSignature,
  mapStatus
};
