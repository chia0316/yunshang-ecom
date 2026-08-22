const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8090';

export class ApiError extends Error {
  status: number;
  fields?: string[];
  constructor(message: string, status: number, fields?: string[]) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

function getToken(): string | null {
  return localStorage.getItem('yunshang_token');
}

interface ApiOptions extends RequestInit {
  auth?: boolean;
}

export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { auth = true, headers, ...rest } = options;
  const finalHeaders: Record<string, string> = {
    ...(headers as Record<string, string>),
  };

  const isFormData = rest.body instanceof FormData;
  if (!isFormData) {
    finalHeaders['Content-Type'] = 'application/json';
  }

  if (auth) {
    const token = getToken();
    if (token) {
      finalHeaders['Authorization'] = `Bearer ${token}`;
    }
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...rest, headers: finalHeaders });
  } catch {
    // fetch() only throws for a network-layer failure (no response at all —
    // connection refused/reset, offline, DNS, etc.), never for a real HTTP
    // error status. That's not recoverable by retrying the same request
    // silently, so point the user at a refresh instead of surfacing the raw
    // "Failed to fetch" browser message.
    throw new ApiError('Network error — please check your connection and refresh the page.', 0);
  }

  const contentType = res.headers.get('content-type');
  const data = contentType?.includes('application/json') ? await res.json() : undefined;

  if (!res.ok) {
    // A 401 on an authenticated request means the token is missing/expired/
    // invalid (see cust-admin-BE/utils/authenticator.js — every 401 in the
    // backend comes from there) — bounce to login instead of leaving the
    // page stuck showing a raw "Error parsing auth token" message.
    if (res.status === 401 && auth) {
      localStorage.removeItem('yunshang_token');
      localStorage.removeItem('yunshang_user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    throw new ApiError(data?.error || 'Request failed', res.status, data?.fields);
  }

  return data as T;
}

export function getProductImageUrl(filename?: string | null): string {
  if (!filename) {
    return 'https://images.pexels.com/photos/1080721/pexels-photo-1080721.jpeg?auto=compress&cs=tinysrgb&w=600';
  }
  return `${API_URL}/static/images/${filename}`;
}

export function getProductVideoUrl(filename?: string | null): string | null {
  if (!filename) return null;
  return `${API_URL}/static/videos/${filename}`;
}

export { API_URL };
