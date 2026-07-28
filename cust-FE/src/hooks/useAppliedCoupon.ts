import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';

interface CouponValidation {
  code: string;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  discountAmount: number;
}

// Coupon discount is never trusted from anywhere but the backend — this
// re-validates against the live subtotal any time the cart's applied code
// or subtotal changes, so a stale discount can never be shown or charged.
export function useAppliedCoupon(code: string | null, subtotal: number) {
  const [coupon, setCoupon] = useState<CouponValidation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!code) {
      setCoupon(null);
      setError(null);
      return;
    }
    setLoading(true);
    apiFetch<CouponValidation>('/api/coupons/validate', {
      auth: false,
      method: 'POST',
      body: JSON.stringify({ code, subtotal }),
    })
      .then((res) => {
        setCoupon(res);
        setError(null);
      })
      .catch((err) => {
        setCoupon(null);
        setError(err instanceof Error ? err.message : 'Invalid coupon code');
      })
      .finally(() => setLoading(false));
  }, [code, subtotal]);

  return { coupon, error, loading };
}
