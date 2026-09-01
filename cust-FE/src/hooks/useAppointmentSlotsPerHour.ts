import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';

const DEFAULT_SLOTS_PER_HOUR = 1;

// Admin-configurable via /api/settings (see admin-FE Settings > General >
// Appointments) — falls back to 1 (today's fixed behavior) if it can't be
// reached, matching the backend's own default in routes/enquiries.js.
export function useAppointmentSlotsPerHour(): number {
  const [slotsPerHour, setSlotsPerHour] = useState(DEFAULT_SLOTS_PER_HOUR);

  useEffect(() => {
    apiFetch<Record<string, string>>('/api/settings', { auth: false })
      .then((settings) => {
        const value = parseInt(settings.appointment_slots_per_hour, 10);
        if (Number.isFinite(value) && value > 0) setSlotsPerHour(value);
      })
      .catch(() => undefined);
  }, []);

  return slotsPerHour;
}
