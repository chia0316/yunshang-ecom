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

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...rest,
      headers: finalHeaders,
    });
  } catch {
    // fetch() only throws for a network-layer failure (no response at all —
    // connection refused/reset, offline, DNS, etc.), never for a real HTTP
    // error status. That's not recoverable by retrying the same request
    // silently, so point the user at a refresh instead of surfacing the raw
    // "Failed to fetch" browser message.
    throw new ApiError("Network error — please check your connection and refresh the page.", 0);
  }

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
  // Next's basePath (see next.config.ts) prefixes router.push/<Link> paths
  // automatically, but not a raw window.location assignment — has to be
  // built in by hand here.
  const loginPath = `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/login`;
  if (window.location.pathname !== loginPath) {
    window.location.href = loginPath;
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
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
  } catch {
    throw new ApiError("Network error — please check your connection and refresh the page.", 0);
  }
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

// For large multipart uploads (e.g. the product bulk-upload dialog) that
// need a progress percentage — fetch() has no cross-browser-reliable way to
// report upload progress, so this uses XMLHttpRequest instead, which does.
export function apiUpload<T>(
  path: string,
  formData: FormData,
  onProgress?: (percent: number) => void
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_URL}${path}`);
    const token = getToken();
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      let data: { error?: string } | undefined;
      try {
        data = xhr.responseText ? JSON.parse(xhr.responseText) : undefined;
      } catch {
        data = undefined;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data as T);
      } else {
        if (xhr.status === 401) redirectToLogin();
        reject(new ApiError(data?.error || "Request failed", xhr.status));
      }
    };

    // Fires on a genuine network-layer failure (connection dropped mid
    // transfer, offline, DNS, etc.) — same case apiFetch's catch handles,
    // just via XHR's event instead of a thrown exception. The upload is
    // safe to simply retry: bulk-upload matches rows by SKU, so re-sending
    // the same file only re-applies the same creates/updates, never
    // duplicates — nothing needs to be undone first.
    xhr.onerror = () => {
      reject(
        new ApiError(
          "Upload interrupted — check your connection and try again. It's safe to re-upload the same file; existing rows are matched by SKU, not duplicated.",
          0
        )
      );
    };

    xhr.send(formData);
  });
}

export { API_URL };
