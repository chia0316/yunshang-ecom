import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, ArrowLeft, Check, ShieldCheck, Truck, QrCode } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useAppliedCoupon } from '../hooks/useAppliedCoupon';
import { useFreeDeliveryThreshold } from '../hooks/useFreeDeliveryThreshold';
import { useCompanySettings } from '../hooks/useCompanySettings';
import { apiFetch, ApiError } from '../lib/api';
import type { Order } from '../lib/types';

const PAYMENT_METHODS = ['PayNow', 'NETS', 'Card', 'Cash'] as const;

// NETS and Card aren't live yet — only these are offered at checkout for now.
const ENABLED_PAYMENT_METHODS: (typeof PAYMENT_METHODS)[number][] = ['PayNow', 'Cash'];

// No payment gateway is live yet. PayNow and Cash are confirmed manually by
// an admin after the fact (QR scan / pay-at-office respectively) instead of
// the auto-confirm simulation NETS/Card still use below.
const MANUAL_PAYMENT_METHODS: (typeof PAYMENT_METHODS)[number][] = ['PayNow', 'Cash'];

type CheckoutStep = 'delivery' | 'account' | 'payment' | 'confirmation';

const QR_TIMER_SECONDS = 300;

const formatTimer = (totalSeconds: number) => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

// Falls back to a clear placeholder if cust-FE/public/paynow-qr.jpg is ever
// missing (e.g. a future re-upload under a different filename) instead of
// showing a broken image.
const PayNowQrCode: React.FC = () => {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="w-72 h-72 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400">
        <QrCode className="w-16 h-16 mb-2" />
        <span className="text-sm text-center px-2">QR code coming soon</span>
      </div>
    );
  }
  return (
    <img
      src="/paynow-qr.jpg"
      alt="PayNow QR code"
      className="w-72 h-72 object-contain border border-gray-200 rounded-lg"
      onError={() => setFailed(true)}
    />
  );
};

interface Profile {
  firstName: string;
  lastName: string;
  mobile: string | null;
  deliveryAddress: string | null;
  deliveryPostal: string | null;
}

const CheckoutPage: React.FC = () => {
  const { state, clearCart } = useCart();
  const { user, signup } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<CheckoutStep>('delivery');
  const [submitting, setSubmitting] = useState(false);
  const [processingLabel, setProcessingLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [placedOrder, setPlacedOrder] = useState<Order | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [useDifferentAddress, setUseDifferentAddress] = useState(false);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    contact: '',
    address: '',
    postal: '',
    remarks: '',
  });
  const [paymentMethod, setPaymentMethod] = useState<(typeof PAYMENT_METHODS)[number]>('PayNow');

  // PayNow requires scanning the QR and acknowledging the transfer before
  // the order is actually created (unlike Cash, which places the order
  // immediately and just shows pay-at-office instructions afterward).
  const [payNowGateOpen, setPayNowGateOpen] = useState(false);
  const [qrSecondsLeft, setQrSecondsLeft] = useState(QR_TIMER_SECONDS);

  // Guests need an account created before an order can be tracked — collected
  // right before payment so nothing they've already typed gets lost.
  const [accountForm, setAccountForm] = useState({
    username: '',
    email: '',
    password: '',
  });
  const [accountError, setAccountError] = useState<string | null>(null);
  const [accountConflictFields, setAccountConflictFields] = useState<string[]>([]);
  const [creatingAccount, setCreatingAccount] = useState(false);

  const subtotal = state.total;
  const freeDeliveryThreshold = useFreeDeliveryThreshold();
  const company = useCompanySettings();
  const { coupon } = useAppliedCoupon(state.couponCode, subtotal);
  const discountAmount = coupon?.discountAmount || 0;
  const shipping = subtotal >= freeDeliveryThreshold ? 0 : 50;
  const total = Math.max(subtotal + shipping - discountAmount, 0);

  // Longest lead time across cart items (e.g. a made-to-order piece needing
  // ~2 months) — surfaced as a note rather than a date picker, since delivery
  // is now scheduled after checkout via WhatsApp/email/call, not selected here.
  const maxLeadTimeDays = state.items.reduce(
    (max, item) => Math.max(max, item.leadTimeDays || 0),
    0
  );

  const STEPS: CheckoutStep[] = user
    ? ['delivery', 'payment', 'confirmation']
    : ['delivery', 'account', 'payment', 'confirmation'];
  const stepIndex = STEPS.indexOf(step);

  useEffect(() => {
    if (!user) return;
    apiFetch<{ data: Profile }>('/user/user-data')
      .then(({ data }) => {
        setProfile(data);
        setFormData((prev) => ({
          ...prev,
          firstName: prev.firstName || data.firstName || '',
          lastName: prev.lastName || data.lastName || '',
          contact: prev.contact || data.mobile || '',
          address: prev.address || data.deliveryAddress || '',
          postal: prev.postal || data.deliveryPostal || '',
        }));
      })
      .catch(() => undefined);
  }, [user]);

  useEffect(() => {
    if (!payNowGateOpen) return;
    const timer = setInterval(() => {
      setQrSecondsLeft((s) => Math.max(s - 1, 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [payNowGateOpen]);

  // QR session expired without payment being confirmed — send the customer
  // back to their cart rather than leaving them stuck on a stale code.
  useEffect(() => {
    if (payNowGateOpen && qrSecondsLeft === 0) {
      navigate('/cart');
    }
  }, [payNowGateOpen, qrSecondsLeft, navigate]);

  const openPayNowGate = () => {
    setError(null);
    setQrSecondsLeft(QR_TIMER_SECONDS);
    setPayNowGateOpen(true);
  };

  const closePayNowGate = () => {
    setPayNowGateOpen(false);
    setQrSecondsLeft(QR_TIMER_SECONDS);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const toggleDifferentAddress = (checked: boolean) => {
    setUseDifferentAddress(checked);
    if (!checked && profile) {
      setFormData((prev) => ({
        ...prev,
        address: profile.deliveryAddress || '',
        postal: profile.deliveryPostal || '',
      }));
    } else if (checked) {
      setFormData((prev) => ({ ...prev, address: '', postal: '' }));
    }
  };

  const goToNextStep = () => {
    const idx = STEPS.indexOf(step);
    if (idx < STEPS.length - 1) {
      setStep(STEPS[idx + 1]);
    }
  };

  const goToPreviousStep = () => {
    const idx = STEPS.indexOf(step);
    if (idx > 0) {
      setStep(STEPS[idx - 1]);
    }
  };

  const handleDeliverySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    goToNextStep();
  };

  const handleAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAccountError(null);
    setAccountConflictFields([]);
    setCreatingAccount(true);
    try {
      await signup({
        username: accountForm.username,
        email: accountForm.email,
        password: accountForm.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
        mobile: formData.contact,
        deliveryAddress: formData.address,
        deliveryPostal: formData.postal,
      });
      goToNextStep();
    } catch (err) {
      if (err instanceof ApiError) {
        setAccountError(err.message);
        setAccountConflictFields(err.fields || []);
      } else {
        setAccountError(err instanceof Error ? err.message : 'Failed to create account');
      }
    } finally {
      setCreatingAccount(false);
    }
  };

  const accountFieldClass = (name: string) =>
    `w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent ${
      accountConflictFields.includes(name)
        ? 'border-red-400 focus:ring-red-400'
        : 'border-gray-200 focus:ring-terracotta-500'
    }`;

  const placeOrder = async () => {
    setSubmitting(true);
    setProcessingLabel('Placing order...');
    setError(null);
    try {
      const orderRes = await apiFetch<{ order: Order }>('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          // Pre-discount total (subtotal + shipping) — the backend re-validates
          // the coupon and subtracts the discount itself rather than trusting
          // a client-computed amount.
          total_price: subtotal + shipping,
          couponCode: coupon ? coupon.code : undefined,
          firstName: formData.firstName,
          lastName: formData.lastName,
          contact: formData.contact,
          deliveryAddress: formData.address,
          deliveryPostal: formData.postal,
          remarks: formData.remarks || null,
          orderDetails_list: state.items.map((item) => ({
            product_id: item.id,
            quantity: item.quantity,
            price: item.price,
            name: item.name,
          })),
          // Informational only (used for the confirmation email content) —
          // the actual Payment record below is the source of truth.
          paymentMethod,
        }),
      });

      const payment = await apiFetch<{ id: number }>('/api/payments', {
        method: 'POST',
        body: JSON.stringify({
          order_id: orderRes.order.id,
          amount: total,
          currency: 'SGD',
          method: paymentMethod,
        }),
      });

      if (MANUAL_PAYMENT_METHODS.includes(paymentMethod)) {
        // Cash (pay at office) and PayNow (scan QR, pay manually) both stay
        // pending until an admin manually confirms receipt — see
        // PATCH /api/payments/:pid on the backend.
        setPlacedOrder(orderRes.order);
      } else {
        // No payment gateway is integrated yet — this simulates the
        // confirmation a real gateway webhook would send, so the order flow
        // can be exercised end-to-end. Swap for a real gateway redirect/
        // webhook later; see routes/payment.js simulate-confirm on the backend.
        setProcessingLabel(`Confirming ${paymentMethod} payment...`);
        const { order: confirmedOrder } = await apiFetch<{ order: Order }>(
          `/api/payments/${payment.id}/simulate-confirm`,
          { method: 'POST' }
        );
        setPlacedOrder(confirmedOrder);
      }

      clearCart();
      setStep('confirmation');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to place order');
    } finally {
      setSubmitting(false);
      setProcessingLabel(null);
    }
  };

  if (state.items.length === 0 && step !== 'confirmation') {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Your cart is empty</h1>
        <Link to="/products" className="text-terracotta-600 hover:text-terracotta-700">
          Continue shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center mb-8">
        <Link
          to="/cart"
          className="flex items-center text-terracotta-600 hover:text-terracotta-700 font-medium mr-4"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Cart
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Checkout</h1>
      </div>

      {/* Progress Bar */}
      <div className="flex items-center mb-8">
        {STEPS.map((s, index) => (
          <React.Fragment key={s}>
            <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
              stepIndex >= index ? 'bg-stone-900 text-white' : 'bg-gray-200 text-gray-600'
            }`}>
              {stepIndex > index ? <Check className="w-5 h-5" /> : index + 1}
            </div>
            {index < STEPS.length - 1 && (
              <div className={`flex-1 h-1 mx-4 ${stepIndex > index ? 'bg-stone-900' : 'bg-gray-200'}`} />
            )}
          </React.Fragment>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          {step === 'delivery' && (
            <form onSubmit={handleDeliverySubmit} className="space-y-8">
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-6">Delivery Information</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">First Name *</label>
                    <input
                      type="text"
                      name="firstName"
                      required
                      value={formData.firstName}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Last Name *</label>
                    <input
                      type="text"
                      name="lastName"
                      required
                      value={formData.lastName}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500 focus:border-transparent"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Contact Number *</label>
                    <input
                      type="tel"
                      name="contact"
                      required
                      value={formData.contact}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500 focus:border-transparent"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">Delivery Address *</label>
                      {profile?.deliveryAddress && (
                        <label className="flex items-center text-sm text-gray-600">
                          <input
                            type="checkbox"
                            checked={useDifferentAddress}
                            onChange={(e) => toggleDifferentAddress(e.target.checked)}
                            className="mr-2 rounded border-gray-300 text-terracotta-600 focus:ring-terracotta-500"
                          />
                          Ship to a different address
                        </label>
                      )}
                    </div>
                    <input
                      type="text"
                      name="address"
                      required
                      value={formData.address}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Postal Code *</label>
                    <input
                      type="text"
                      name="postal"
                      required
                      value={formData.postal}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500 focus:border-transparent"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <div className="flex items-start gap-3 bg-terracotta-50 border border-terracotta-200 rounded-lg p-4">
                      <Truck className="w-5 h-5 text-terracotta-600 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-gray-700">
                        <p className="font-medium text-gray-900">Delivery is arranged after checkout</p>
                        <p className="mt-1">
                          Deliveries may be scheduled piecemeal depending on availability. Our team
                          will confirm the exact delivery date and time slot with you via WhatsApp,
                          email, or a phone call.
                          {maxLeadTimeDays > 0 &&
                            ` One or more items in your order need about ${Math.round(maxLeadTimeDays / 7)} week${
                              Math.round(maxLeadTimeDays / 7) === 1 ? '' : 's'
                            } to prepare before they can be delivered.`}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Delivery Notes</label>
                    <textarea
                      name="remarks"
                      rows={2}
                      value={formData.remarks}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div />
                <button
                  type="submit"
                  className="flex items-center px-6 py-3 bg-stone-900 text-white rounded-lg hover:bg-stone-800 transition-colors font-medium ml-auto"
                >
                  Continue
                </button>
              </div>
            </form>
          )}

          {step === 'account' && (
            <form onSubmit={handleAccountSubmit} className="space-y-8">
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-start gap-3 mb-6">
                  <ShieldCheck className="w-6 h-6 text-terracotta-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Create your account</h2>
                    <p className="text-sm text-gray-600 mt-1">
                      We need an account on file so we can send you order updates and let you
                      track this order&apos;s delivery status afterwards. Your delivery details
                      from the last step are already saved.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Username *</label>
                    <input
                      type="text"
                      required
                      minLength={5}
                      value={accountForm.username}
                      onChange={(e) => {
                        setAccountForm({ ...accountForm, username: e.target.value });
                        setAccountConflictFields((prev) => prev.filter((f) => f !== 'username'));
                      }}
                      className={accountFieldClass('username')}
                    />
                    {accountConflictFields.includes('username') && (
                      <p className="text-xs text-red-600 mt-1">This username is already taken.</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                    <input
                      type="email"
                      required
                      value={accountForm.email}
                      onChange={(e) => {
                        setAccountForm({ ...accountForm, email: e.target.value });
                        setAccountConflictFields((prev) => prev.filter((f) => f !== 'email'));
                      }}
                      className={accountFieldClass('email')}
                    />
                    {accountConflictFields.includes('email') && (
                      <p className="text-xs text-red-600 mt-1">This email is already registered.</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Password *</label>
                    <input
                      type="password"
                      required
                      pattern="(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&]).{8,}"
                      title="Minimum eight characters, at least one letter, one number and one special character"
                      value={accountForm.password}
                      onChange={(e) => setAccountForm({ ...accountForm, password: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Min. 8 characters with a letter, a number, and a special character (@$!%*#?&).
                    </p>
                  </div>
                </div>
                {accountError && <p className="text-sm text-red-600 mt-4">{accountError}</p>}
                <p className="text-sm text-gray-600 mt-6">
                  Already have an account?{' '}
                  <Link to="/login" className="text-terracotta-600 hover:text-terracotta-700 font-medium">
                    Log in
                  </Link>{' '}
                  instead.
                </p>
              </div>

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={goToPreviousStep}
                  className="flex items-center px-6 py-3 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </button>
                <button
                  type="submit"
                  disabled={creatingAccount}
                  className="flex items-center px-6 py-3 bg-stone-900 text-white rounded-lg hover:bg-stone-800 transition-colors font-medium disabled:opacity-50"
                >
                  {creatingAccount ? 'Creating account...' : 'Create Account & Continue'}
                </button>
              </div>
            </form>
          )}

          {step === 'payment' && !payNowGateOpen && (
            <div className="space-y-8">
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-6">Payment Method</h2>
                <div className="grid grid-cols-2 gap-4">
                  {ENABLED_PAYMENT_METHODS.map((method) => (
                    <button
                      type="button"
                      key={method}
                      onClick={() => setPaymentMethod(method)}
                      className={`px-4 py-4 border rounded-lg text-sm font-medium ${
                        paymentMethod === method
                          ? 'border-terracotta-600 bg-terracotta-50 text-terracotta-600'
                          : 'border-gray-200 text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
                <p className="text-sm text-gray-500 mt-4">
                  {paymentMethod === 'PayNow' && "You'll scan a QR code and confirm payment before your order is placed."}
                  {paymentMethod === 'NETS' && "You'll receive NETS payment instructions after placing your order."}
                  {paymentMethod === 'Card' && 'Card payment instructions will be sent after placing your order.'}
                  {paymentMethod === 'Cash' && 'Pay in cash at our office within 7 days of placing your order.'}
                </p>
                {error && <p className="text-sm text-red-600 mt-4">{error}</p>}
              </div>

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={goToPreviousStep}
                  className="flex items-center px-6 py-3 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </button>
                <button
                  type="button"
                  onClick={paymentMethod === 'PayNow' ? openPayNowGate : placeOrder}
                  disabled={submitting}
                  className="flex items-center px-6 py-3 bg-stone-900 text-white rounded-lg hover:bg-stone-800 transition-colors font-medium disabled:opacity-50"
                >
                  <Lock className="w-4 h-4 mr-2" />
                  {paymentMethod === 'PayNow'
                    ? 'Continue to Payment'
                    : submitting
                      ? processingLabel || 'Placing Order...'
                      : 'Place Order'}
                </button>
              </div>
            </div>
          )}

          {step === 'payment' && payNowGateOpen && (
            <div className="space-y-8">
              <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
                <h2 className="text-xl font-bold text-gray-900 mb-2">Scan to Pay via PayNow</h2>
                <p className="text-sm text-gray-600 mb-6">
                  Scan the QR code with your banking app to pay <strong>${total.toFixed(2)}</strong>.
                  Once you&apos;ve made the transfer, confirm below to place your order.
                </p>

                <div className="flex justify-center mb-4">
                  <PayNowQrCode />
                </div>

                <p className="text-sm text-gray-500 mb-6">
                  Time remaining: <strong className="text-gray-900">{formatTimer(qrSecondsLeft)}</strong>
                </p>

                {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

                <button
                  type="button"
                  onClick={placeOrder}
                  disabled={submitting || qrSecondsLeft === 0}
                  className="w-full flex items-center justify-center px-6 py-3 bg-stone-900 text-white rounded-lg hover:bg-stone-800 transition-colors font-semibold disabled:opacity-50"
                >
                  {submitting ? processingLabel || 'Confirming...' : "I've Made the Payment"}
                </button>
              </div>

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={closePayNowGate}
                  disabled={submitting}
                  className="flex items-center px-6 py-3 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Change Payment Method
                </button>
              </div>
            </div>
          )}

          {step === 'confirmation' && placedOrder && (
            <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Order Confirmed!</h2>
              <p className="text-gray-600 mb-6">
                Thank you for your purchase. Your order has been received and is being processed.
              </p>
              <div className="bg-gray-50 p-4 rounded-lg mb-6 text-left">
                <p className="text-sm text-gray-600">Order Number: <strong>{placedOrder.order_number}</strong></p>
                <p className="text-sm text-gray-600">Payment method: <strong>{paymentMethod}</strong></p>
                {paymentMethod === 'Cash' ? (
                  <>
                    <p className="text-sm text-gray-600">
                      Payment status: <strong className="text-terracotta-600">Pending — pay in cash at our office</strong>
                    </p>
                    <p className="text-sm text-gray-600 mt-2">
                      Please pay within 7 days to confirm your order.
                      {company.address && <> Our office: <strong>{company.address}</strong>.</>}
                      {company.phone && <> Call us at <strong>{company.phone}</strong> to arrange a time.</>}
                    </p>
                  </>
                ) : paymentMethod === 'PayNow' ? (
                  <>
                    <p className="text-sm text-gray-600">
                      Payment status: <strong className="text-terracotta-600">Pending — verifying your PayNow payment</strong>
                    </p>
                    <p className="text-sm text-gray-600 mt-2">
                      Thanks for confirming your transfer of ${total.toFixed(2)}. We&apos;ll confirm your
                      order once payment is received on our end.
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-gray-600">Payment status: <strong className="text-green-600">Paid (simulated)</strong></p>
                )}
              </div>
              <div className="flex justify-center gap-4">
                <Link
                  to="/account/orders"
                  className="inline-block bg-stone-900 text-white py-3 px-6 rounded-lg hover:bg-stone-800 transition-colors font-medium"
                >
                  Track Order
                </Link>
                <Link
                  to="/"
                  className="inline-block border border-gray-200 text-gray-700 py-3 px-6 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Continue Shopping
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Order Summary */}
        {step !== 'confirmation' && (
          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm h-fit">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Order Summary</h2>

            <div className="space-y-4 mb-6">
              {state.items.map((item) => (
                <div key={item.id} className="flex items-center space-x-4">
                  <img src={item.image} alt={item.name} className="w-16 h-16 object-cover rounded-lg" />
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">{item.name}</h3>
                    <p className="text-sm text-gray-600">Qty: {item.quantity}</p>
                  </div>
                  <span className="font-medium">${(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="space-y-3 border-t pt-4">
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
                <span className="font-medium">{shipping === 0 ? 'Free' : `$${shipping.toFixed(2)}`}</span>
              </div>

              <div className="border-t pt-3">
                <div className="flex justify-between">
                  <span className="text-lg font-bold">Total</span>
                  <span className="text-2xl font-bold text-gray-900">${total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CheckoutPage;
