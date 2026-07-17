import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock, ArrowLeft, Check, ShieldCheck } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import type { DeliverySlot, Order } from '../lib/types';

const PAYMENT_METHODS = ['PayNow', 'NETS', 'Card', 'Cash'] as const;

type CheckoutStep = 'delivery' | 'account' | 'payment' | 'confirmation';

interface Profile {
  firstName: string;
  lastName: string;
  mobile: string | null;
  deliveryAddress: string | null;
  deliveryPostal: string | null;
}

const toDateInput = (date: Date) => date.toISOString().slice(0, 10);

const CheckoutPage: React.FC = () => {
  const { state, dispatch } = useCart();
  const { user, signup } = useAuth();

  const [step, setStep] = useState<CheckoutStep>('delivery');
  const [submitting, setSubmitting] = useState(false);
  const [processingLabel, setProcessingLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [placedOrder, setPlacedOrder] = useState<Order | null>(null);

  const [deliverySlots, setDeliverySlots] = useState<DeliverySlot[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [useDifferentAddress, setUseDifferentAddress] = useState(false);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    contact: '',
    address: '',
    postal: '',
    deliveryDate: '',
    deliverySlot: '',
    remarks: '',
  });
  const [paymentMethod, setPaymentMethod] = useState<(typeof PAYMENT_METHODS)[number]>('PayNow');

  // Guests need an account created before an order can be tracked — collected
  // right before payment so nothing they've already typed gets lost.
  const [accountForm, setAccountForm] = useState({
    username: '',
    email: '',
    password: '',
  });
  const [accountError, setAccountError] = useState<string | null>(null);
  const [creatingAccount, setCreatingAccount] = useState(false);

  const subtotal = state.total;
  const shipping = subtotal > 500 ? 0 : 50;
  const total = subtotal + shipping;

  // Earliest date any item in the cart can actually be delivered, based on
  // the longest product lead time (e.g. a made-to-order piece needing ~2
  // months) — never let the customer pick a date the order can't be ready by.
  const maxLeadTimeDays = state.items.reduce(
    (max, item) => Math.max(max, item.leadTimeDays || 0),
    0
  );
  const minDeliveryDate = toDateInput(
    new Date(Date.now() + maxLeadTimeDays * 24 * 60 * 60 * 1000)
  );

  const STEPS: CheckoutStep[] = user
    ? ['delivery', 'payment', 'confirmation']
    : ['delivery', 'account', 'payment', 'confirmation'];
  const stepIndex = STEPS.indexOf(step);

  useEffect(() => {
    apiFetch<DeliverySlot[]>('/api/delivery-slots', { auth: false })
      .then((slots) => {
        setDeliverySlots(slots);
        if (slots.length > 0) {
          setFormData((prev) => ({ ...prev, deliverySlot: prev.deliverySlot || slots[0].name }));
        }
      })
      .catch(() => undefined);
  }, []);

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
    setFormData((prev) =>
      !prev.deliveryDate || prev.deliveryDate < minDeliveryDate
        ? { ...prev, deliveryDate: minDeliveryDate }
        : prev
    );
  }, [minDeliveryDate]);

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
      setAccountError(err instanceof Error ? err.message : 'Failed to create account');
    } finally {
      setCreatingAccount(false);
    }
  };

  const placeOrder = async () => {
    setSubmitting(true);
    setProcessingLabel('Placing order...');
    setError(null);
    try {
      const orderRes = await apiFetch<{ order: Order }>('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          total_price: total,
          firstName: formData.firstName,
          lastName: formData.lastName,
          contact: formData.contact,
          deliveryAddress: formData.address,
          deliveryPostal: formData.postal,
          deliveryDate: formData.deliveryDate || null,
          deliverySlot: formData.deliverySlot,
          remarks: formData.remarks || null,
          orderDetails_list: state.items.map((item) => ({
            product_id: item.id,
            quantity: item.quantity,
            price: item.price,
            name: item.name,
          })),
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
      dispatch({ type: 'CLEAR_CART' });
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
        <Link to="/products" className="text-amber-600 hover:text-amber-700">
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
          className="flex items-center text-amber-600 hover:text-amber-700 font-medium mr-4"
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
              stepIndex >= index ? 'bg-amber-600 text-white' : 'bg-gray-200 text-gray-600'
            }`}>
              {stepIndex > index ? <Check className="w-5 h-5" /> : index + 1}
            </div>
            {index < STEPS.length - 1 && (
              <div className={`flex-1 h-1 mx-4 ${stepIndex > index ? 'bg-amber-600' : 'bg-gray-200'}`} />
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
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
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
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Contact Number *</label>
                    <input
                      type="tel"
                      name="contact"
                      required
                      value={formData.contact}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
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
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
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
                            className="mr-2 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
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
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Preferred Delivery Date</label>
                    <input
                      type="date"
                      name="deliveryDate"
                      min={minDeliveryDate}
                      value={formData.deliveryDate}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    />
                    {maxLeadTimeDays > 0 && (
                      <p className="text-xs text-amber-600 mt-1">
                        One or more items in your cart need ~{Math.round(maxLeadTimeDays / 7)} week
                        {Math.round(maxLeadTimeDays / 7) === 1 ? '' : 's'} to prepare, so the earliest
                        delivery date is {new Date(minDeliveryDate).toLocaleDateString()}.
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Delivery Slot</label>
                    <select
                      name="deliverySlot"
                      value={formData.deliverySlot}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    >
                      {deliverySlots.map((slot) => (
                        <option key={slot.id} value={slot.name}>
                          {slot.name}
                          {slot.time_range ? ` (${slot.time_range})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Delivery Notes</label>
                    <textarea
                      name="remarks"
                      rows={2}
                      value={formData.remarks}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div />
                <button
                  type="submit"
                  className="flex items-center px-6 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-medium ml-auto"
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
                  <ShieldCheck className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
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
                      onChange={(e) => setAccountForm({ ...accountForm, username: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                    <input
                      type="email"
                      required
                      value={accountForm.email}
                      onChange={(e) => setAccountForm({ ...accountForm, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    />
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
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Min. 8 characters with a letter, a number, and a special character (@$!%*#?&).
                    </p>
                  </div>
                </div>
                {accountError && <p className="text-sm text-red-600 mt-4">{accountError}</p>}
                <p className="text-sm text-gray-600 mt-6">
                  Already have an account?{' '}
                  <Link to="/login" className="text-amber-600 hover:text-amber-700 font-medium">
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
                  className="flex items-center px-6 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-medium disabled:opacity-50"
                >
                  {creatingAccount ? 'Creating account...' : 'Create Account & Continue'}
                </button>
              </div>
            </form>
          )}

          {step === 'payment' && (
            <div className="space-y-8">
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-6">Payment Method</h2>
                <div className="grid grid-cols-2 gap-4">
                  {PAYMENT_METHODS.map((method) => (
                    <button
                      type="button"
                      key={method}
                      onClick={() => setPaymentMethod(method)}
                      className={`px-4 py-4 border rounded-lg text-sm font-medium ${
                        paymentMethod === method
                          ? 'border-amber-600 bg-amber-50 text-amber-600'
                          : 'border-gray-200 text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
                <p className="text-sm text-gray-500 mt-4">
                  {paymentMethod === 'PayNow' && "You'll receive a PayNow QR code to complete payment after placing your order."}
                  {paymentMethod === 'NETS' && "You'll receive NETS payment instructions after placing your order."}
                  {paymentMethod === 'Card' && 'Card payment instructions will be sent after placing your order.'}
                  {paymentMethod === 'Cash' && 'Pay by cash upon delivery.'}
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
                  onClick={placeOrder}
                  disabled={submitting}
                  className="flex items-center px-6 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-medium disabled:opacity-50"
                >
                  <Lock className="w-4 h-4 mr-2" />
                  {submitting ? processingLabel || 'Placing Order...' : 'Place Order'}
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
              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <p className="text-sm text-gray-600">Order Number: <strong>#{placedOrder.id}</strong></p>
                <p className="text-sm text-gray-600">Payment method: <strong>{paymentMethod}</strong></p>
                <p className="text-sm text-gray-600">Payment status: <strong className="text-green-600">Paid (simulated)</strong></p>
              </div>
              <div className="flex justify-center gap-4">
                <Link
                  to="/account/orders"
                  className="inline-block bg-amber-600 text-white py-3 px-6 rounded-lg hover:bg-amber-700 transition-colors font-medium"
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
