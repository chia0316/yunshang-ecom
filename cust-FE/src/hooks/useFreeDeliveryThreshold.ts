import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';

const DEFAULT_THRESHOLD = 500;

// Admin-configurable via /api/settings — falls back to the old hardcoded
// value if the setting can't be reached, so shipping calculation never breaks.
export function useFreeDeliveryThreshold(): number {
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD);

  useEffect(() => {
    apiFetch<Record<string, string>>('/api/settings', { auth: false })
      .then((settings) => {
        const value = Number(settings.free_delivery_threshold);
        if (!isNaN(value)) setThreshold(value);
      })
      .catch(() => undefined);
  }, []);

  return threshold;
}
