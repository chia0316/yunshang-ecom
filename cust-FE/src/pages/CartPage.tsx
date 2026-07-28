import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Minus, Plus, X, ShoppingBag, ArrowLeft, Tag, ChevronDown, ChevronUp } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAppliedCoupon } from '../hooks/useAppliedCoupon';
import { useFreeDeliveryThreshold } from '../hooks/useFreeDeliveryThreshold';
import { apiFetch } from '../lib/api';
import type { AvailableCoupon } from '../lib/types';

const describeCoupon = (c: AvailableCoupon) => {
  const amount = c.discount_type === 'percent' ? `${c.discount_value}% off` : `$${c.discount_value.toFixed(2)} off`;
  return c.min_order_amount ? `${amount} orders $${c.min_order_amount.toFixed(2)}+` : amount;
};

const CartPage: React.FC = () => {
  const {
    state,
    updateQuantity: updateQuantityCtx,
    removeFromCart,
    applyCoupon: applyCouponCtx,
    removeCoupon: removeCouponCtx,
  } = useCart();
  const [couponInput, setCouponInput] = useState('');
  const [availableCoupons, setAvailableCoupons] = useState<AvailableCoupon[]>([]);
  const [showAvailable, setShowAvailable] = useState(false);

  const subtotal = state.total;
  const freeDeliveryThreshold = useFreeDeliveryThreshold();
  const { coupon, error: couponError } = useAppliedCoupon(state.couponCode, subtotal);
  const discountAmount = coupon?.discountAmount || 0;
  const shipping = subtotal >= freeDeliveryThreshold ? 0 : 50;
  const total = Math.max(subtotal + shipping - discountAmount, 0);

  useEffect(() => {
    apiFetch<AvailableCoupon[]>('/api/coupons/available', { auth: false })
      .then(setAvailableCoupons)
      .catch(() => undefined);
  }, []);

  const updateQuantity = (id: number, quantity: number) => {
    updateQuantityCtx(id, quantity);
  };

  const removeItem = (id: number) => {
    removeFromCart(id);
  };

  const applyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponInput.trim()) return;
    applyCouponCtx(couponInput.trim().toUpperCase());
  };

  const applyCouponCode = (code: string) => {
    applyCouponCtx(code);
    setShowAvailable(false);
  };

  const removeCoupon = () => {
    removeCouponCtx();
    setCouponInput('');
  };

  if (state.items.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center">
          <ShoppingBag className="mx-auto w-16 h-16 text-gray-300 mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Your cart is empty</h1>
          <p className="text-gray-600 mb-8">Start shopping to add items to your cart</p>
          <Link
            to="/products"
            className="inline-flex items-center px-6 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-medium"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Continue Shopping
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center mb-8">
        <Link
          to="/products"
          className="flex items-center text-amber-600 hover:text-amber-700 font-medium mr-4"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Continue Shopping
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Shopping Cart</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Cart Items */}
        <div className="lg:col-span-2 space-y-6">
          {state.items.map((item) => (
            <div key={item.id} className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
              <div className="flex flex-col md:flex-row gap-6">
                <div className="w-full md:w-32 h-32 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="flex-1 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{item.name}</h3>
                      <p className="text-2xl font-bold text-gray-900 mt-2">${item.price.toFixed(2)}</p>
                    </div>

                    <button
                      onClick={() => removeItem(item.id)}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center border border-gray-200 rounded-lg">
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="p-2 hover:bg-gray-100 transition-colors"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="px-4 py-2 font-medium">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="p-2 hover:bg-gray-100 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>

                    <p className="text-xl font-bold text-gray-900">
                      ${(item.price * item.quantity).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Order Summary */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm h-fit">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Order Summary</h2>

          <form onSubmit={applyCoupon} className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Coupon Code</label>
            {coupon ? (
              <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                <div className="flex items-center text-sm text-green-700">
                  <Tag className="w-4 h-4 mr-2" />
                  <span className="font-mono font-medium">{coupon.code}</span>
                  <span className="ml-2">applied</span>
                </div>
                <button
                  type="button"
                  onClick={removeCoupon}
                  className="text-green-700 hover:text-green-900"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                  placeholder="Enter code"
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                />
                <button
                  type="submit"
                  className="px-4 py-2 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
                >
                  Apply
                </button>
              </div>
            )}
            {couponError && <p className="text-sm text-red-600 mt-2">{couponError}</p>}

            {!coupon && availableCoupons.length > 0 && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setShowAvailable(!showAvailable)}
                  className="flex items-center text-sm text-amber-600 hover:text-amber-700 font-medium"
                >
                  {showAvailable ? 'Hide' : 'View'} available codes ({availableCoupons.length})
                  {showAvailable ? (
                    <ChevronUp className="w-4 h-4 ml-1" />
                  ) : (
                    <ChevronDown className="w-4 h-4 ml-1" />
                  )}
                </button>
                {showAvailable && (
                  <div className="mt-2 space-y-2">
                    {availableCoupons.map((c) => (
                      <div
                        key={c.code}
                        className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2"
                      >
                        <div>
                          <span className="font-mono font-medium text-sm text-gray-900">{c.code}</span>
                          <p className="text-xs text-gray-500">{describeCoupon(c)}</p>
                          <p className="text-xs text-gray-400">
                            {c.remaining_uses === null
                              ? 'Unlimited uses'
                              : `${c.remaining_uses} use${c.remaining_uses === 1 ? '' : 's'} left`}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => applyCouponCode(c.code)}
                          className="text-sm px-3 py-1.5 border border-amber-600 text-amber-600 rounded-lg hover:bg-amber-600 hover:text-white transition-colors font-medium"
                        >
                          Apply
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </form>

          <div className="space-y-3 mb-6">
            <div className="flex justify-between">
              <span className="text-gray-600">Subtotal</span>
              <span className="font-medium">${subtotal.toFixed(2)}</span>
            </div>

            {discountAmount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount ({coupon?.code})</span>
                <span className="font-medium">-${discountAmount.toFixed(2)}</span>
              </div>
            )}

            <div className="flex justify-between">
              <span className="text-gray-600">Shipping</span>
              <span className="font-medium">
                {shipping === 0 ? 'Free' : `$${shipping.toFixed(2)}`}
              </span>
            </div>

            <div className="border-t pt-3">
              <div className="flex justify-between">
                <span className="text-lg font-bold">Total</span>
                <span className="text-2xl font-bold text-gray-900">${total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {shipping > 0 && (
            <p className="text-sm text-gray-500 mb-4">
              Add ${(freeDeliveryThreshold - subtotal).toFixed(2)} more for free shipping!
            </p>
          )}

          <Link
            to="/checkout"
            className="w-full bg-amber-600 text-white py-4 px-6 rounded-lg hover:bg-amber-700 transition-colors font-semibold text-lg text-center block"
          >
            Proceed to Checkout
          </Link>
        </div>
      </div>
    </div>
  );
};

export default CartPage;
