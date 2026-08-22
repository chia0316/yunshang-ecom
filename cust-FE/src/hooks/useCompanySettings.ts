import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';

interface CompanySettings {
  name: string;
  address: string;
  phone: string;
  uen: string;
}

const DEFAULTS: CompanySettings = { name: '', address: '', phone: '', uen: '' };

// Reads the same public /api/settings endpoint useFreeDeliveryThreshold does
// — company_* keys are merged in server-side from env vars.
export function useCompanySettings(): CompanySettings {
  const [company, setCompany] = useState<CompanySettings>(DEFAULTS);

  useEffect(() => {
    apiFetch<Record<string, string>>('/api/settings', { auth: false })
      .then((settings) => {
        setCompany({
          name: settings.company_name || '',
          address: settings.company_address || '',
          phone: settings.company_phone || '',
          uen: settings.company_uen || '',
        });
      })
      .catch(() => undefined);
  }, []);

  return company;
}
