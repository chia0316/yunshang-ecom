const Coupon = require('../productModels/Coupon.model');

// Shared by the cart-side "validate" endpoint and order creation — order
// creation re-validates and computes the discount server-side rather than
// trusting whatever the client sends, since coupon math is easy to fake.
const resolveCoupon = async (code, subtotal) => {
  if (!code) {
    return { coupon: null, discountAmount: 0, error: null };
  }
  const coupon = await Coupon.findOne({ where: { code: code.toUpperCase() } });
  if (!coupon || !coupon.is_active) {
    return { coupon: null, discountAmount: 0, error: 'Invalid or inactive coupon code' };
  }
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
    return { coupon: null, discountAmount: 0, error: 'This coupon has expired' };
  }
  if (coupon.max_uses !== null && coupon.used_count >= coupon.max_uses) {
    return { coupon: null, discountAmount: 0, error: 'This coupon has reached its usage limit' };
  }
  if (coupon.min_order_amount && subtotal < Number(coupon.min_order_amount)) {
    return {
      coupon: null,
      discountAmount: 0,
      error: `This coupon requires a minimum order of $${Number(coupon.min_order_amount).toFixed(2)}`
    };
  }

  const rawDiscount =
    coupon.discount_type === 'percent'
      ? subtotal * (Number(coupon.discount_value) / 100)
      : Number(coupon.discount_value);
  const discountAmount = Math.min(rawDiscount, subtotal);

  return { coupon, discountAmount, error: null };
};

module.exports = { resolveCoupon };
