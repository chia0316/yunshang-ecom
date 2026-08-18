const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("yunshang_admin_token");
}

interface ApiOptions extends RequestInit {
  auth?: boolean;
}

export async function apiFetch<T>(
  path: string,
  options: ApiOptions = {}
): Promise<T> {
  const { auth = true, headers, ...rest } = options;
  const finalHeaders: Record<string, string> = {
    ...(headers as Record<string, string>),
  };

  const isFormData = rest.body instanceof FormData;
  if (!isFormData) {
    finalHeaders["Content-Type"] = "application/json";
  }

  if (auth) {
    const token = getToken();
    if (token) {
      finalHeaders["Authorization"] = `Bearer ${token}`;
    }
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: finalHeaders,
  });

  const contentType = res.headers.get("content-type");
  const data = contentType?.includes("application/json")
    ? await res.json()
    : undefined;

  if (!res.ok) {
    // A 401 on an authenticated request means the token is missing/expired/
    // invalid (every 401 in the backend comes from utils/authenticator.js) —
    // bounce to login instead of leaving the page stuck on a raw error.
    if (res.status === 401 && auth) {
      redirectToLogin();
    }
    throw new ApiError(data?.error || "Request failed", res.status);
  }

  return data as T;
}

function redirectToLogin() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("yunshang_admin_token");
  localStorage.removeItem("yunshang_admin_user");
  if (window.location.pathname !== "/login") {
    window.location.href = "/login";
  }
}

export function getProductImageUrl(filename: string): string {
  return `${API_URL}/static/images/${filename}`;
}

export function getProductVideoUrl(filename: string): string {
  return `${API_URL}/static/videos/${filename}`;
}

// For endpoints that return a file (e.g. Excel export) instead of JSON —
// fetches with the auth header apiFetch would normally add, then triggers
// a browser download of the response body.
export async function apiDownload(path: string, filename: string): Promise<void> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) {
    if (res.status === 401) {
      redirectToLogin();
    }
    throw new ApiError("Download failed", res.status);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export { API_URL };
