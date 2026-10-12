import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Check, Loader2, X } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useCart } from '../context/CartContext';
import type { Payment } from '../lib/types';

type ReturnState = 'polling' | 'completed' | 'failed' | 'timeout';

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 60000;
// After the visible "still confirming" message, keep quietly checking at a
// slower pace instead of giving up outright — a late webhook (or admin
// reconciling it manually) should still clear the cart and flip the page to
// "confirmed" on its own, without the customer having to notice or do
// anything, as long as they're still on this page.
const BACKGROUND_POLL_INTERVAL_MS = 15000;

// Atome redirects the browser back here after the customer pays, fails, or
// cancels on its hosted page — but that redirect is never treated as proof
// of anything. Only the webhook-confirmed Payment.status (fetched from our
// own backend) is authoritative, so this page polls for it instead of
// trusting the URL it was given.
const AtomeReturnPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('orderId');
  const orderNumber = searchParams.get('orderNumber');
  const cancelled = searchParams.get('cancelled') === '1';
  const { clearCart } = useCart();

  const [state, setState] = useState<ReturnState>(cancelled ? 'failed' : 'polling');
  const startedAt = useRef(Date.now());

  // A cancelled or failed Atome attempt never gets a second chance on the
  // same order — "Back to Checkout" always starts a fresh one (see
  // CheckoutPage's openAtomeCheckout) — so there's nothing useful left to do
  // with it. Best-effort cleanup, same as PayNow's cancelPendingOrder: the
  // backend also tells Atome to cancel the payment on its side (routes/
  // order.js DELETE /:oid), so it doesn't sit as a live PROCESSING payment
  // in their system for up to 12h.
  const cleanupOrder = () => {
    if (!orderId) return;
    apiFetch(`/api/orders/${orderId}`, { method: 'DELETE' }).catch(() => undefined);
  };

  useEffect(() => {
    if (cancelled) {
      cleanupOrder();
      return;
    }
    if (!orderId) return;

    let cancelledEffect = false;
    const poll = async () => {
      try {
        const payments = await apiFetch<Payment[]>(`/api/payments/order/${orderId}`);
        const atomePayment = payments.find((p) => p.method === 'Atome');
        if (!atomePayment || cancelledEffect) return;

        if (atomePayment.status === 'completed') {
          clearCart();
          setState('completed');
          return;
        }
        if (atomePayment.status === 'failed') {
          cleanupOrder();
          setState('failed');
          return;
        }
        // Past the visible timeout, don't stop — just slow down and keep
        // checking silently (see BACKGROUND_POLL_INTERVAL_MS above).
        const pastTimeout = Date.now() - startedAt.current > POLL_TIMEOUT_MS;
        if (pastTimeout) setState('timeout');
        setTimeout(poll, pastTimeout ? BACKGROUND_POLL_INTERVAL_MS : POLL_INTERVAL_MS);
      } catch {
        if (!cancelledEffect) {
          const pastTimeout = Date.now() - startedAt.current > POLL_TIMEOUT_MS;
          if (pastTimeout) setState('timeout');
          setTimeout(poll, pastTimeout ? BACKGROUND_POLL_INTERVAL_MS : POLL_INTERVAL_MS);
        }
      }
    };

    poll();
    return () => {
      cancelledEffect = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, cancelled]);

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
        {state === 'polling' && (
          <>
            <Loader2 className="w-10 h-10 text-terracotta-600 animate-spin mx-auto mb-4" />
            <h1 className="text-xl font-bold text-gray-900 mb-2">Confirming your payment&hellip;</h1>
            <p className="text-sm text-gray-600">
              We&apos;re verifying your Atome payment with the bank. This usually only takes a
              few seconds.
            </p>
          </>
        )}

        {state === 'completed' && (
          <>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Payment confirmed!</h1>
            <p className="text-sm text-gray-600 mb-6">
              Your Atome payment was successful and your order is being processed.
              {orderNumber && (
                <>
                  {' '}
                  Order Number: <strong className="text-gray-900">{orderNumber}</strong>
                </>
              )}
            </p>
            <Link
              to="/account/orders"
              className="inline-block bg-stone-900 text-white py-3 px-6 rounded-lg hover:bg-stone-800 transition-colors font-medium"
            >
              Track Order
            </Link>
          </>
        )}

        {state === 'failed' && (
          <>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <X className="w-8 h-8 text-red-600" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">
              {cancelled ? 'Payment cancelled' : 'Payment unsuccessful'}
            </h1>
            <p className="text-sm text-gray-600 mb-6">
              {cancelled
                ? "You've cancelled the Atome payment. Your cart has been kept so you can try again or choose another payment method."
                : "Atome wasn't able to process this payment. No charge was made. You can try again or choose another payment method."}
            </p>
            <Link
              to="/checkout"
              className="inline-block bg-stone-900 text-white py-3 px-6 rounded-lg hover:bg-stone-800 transition-colors font-medium"
            >
              Back to Checkout
            </Link>
          </>
        )}

        {state === 'timeout' && (
          <>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Still confirming&hellip;</h1>
            <p className="text-sm text-gray-600 mb-6">
              This is taking longer than expected. We&apos;ll email you as soon as your payment
              is confirmed{orderNumber && <> for order <strong className="text-gray-900">{orderNumber}</strong></>}.
            </p>
            <Link
              to="/account/orders"
              className="inline-block bg-stone-900 text-white py-3 px-6 rounded-lg hover:bg-stone-800 transition-colors font-medium"
            >
              View My Orders
            </Link>
          </>
        )}
      </div>
    </div>
  );
};

export default AtomeReturnPage;
