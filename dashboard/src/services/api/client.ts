import { warnIfInsecureHttpUrl } from '../../utils/urlSecurity.ts';

const API_ORIGIN = (import.meta.env?.VITE_API_URL ?? '').replace(/\/+$/, '');
export const API_BASE_URL = `${API_ORIGIN}/api`;

if (API_ORIGIN) warnIfInsecureHttpUrl(API_ORIGIN, 'VITE_API_URL');

export async function handleErrorResponse<T>(response: Response): Promise<T> {
  if (response.status === 401) {
    sessionStorage.removeItem('leadweave_logged_in');
    sessionStorage.removeItem('leadweave_api_key');
    sessionStorage.removeItem('leadweave_supabase_token');
    if (typeof window !== 'undefined') {
      window.location.assign('/');
      return new Promise<T>(() => {});
    }
  }

  const error = await response.json().catch(() => ({}));
  const err = new Error(error.message || `HTTP ${response.status}`) as Error & {
    status?: number;
    code?: string;
  };
  err.status = response.status;
  if (typeof error.code === 'string') err.code = error.code;
  throw err;
}

export const CSRF_HEADERS: Record<string, string> = {
  'X-Requested-With': 'XMLHttpRequest',
};

export async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const isFormData = options.body instanceof FormData;
  const headers: HeadersInit = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...CSRF_HEADERS,
    ...options.headers,
  };

  const response = await fetch(url, {
    credentials: 'include',
    ...options,
    headers,
  });

  if (!response.ok) {
    return handleErrorResponse<T>(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

export async function requestText(endpoint: string): Promise<string> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    credentials: 'include',
    headers: { ...CSRF_HEADERS },
  });

  if (!response.ok) {
    return handleErrorResponse<string>(response);
  }

  return response.text();
}

export async function requestBlob(endpoint: string): Promise<Blob> {
  const url = `${API_BASE_URL}${endpoint}`;

  const headers: HeadersInit = {
    ...CSRF_HEADERS,
  };

  const response = await fetch(url, {
    credentials: 'include',
    headers,
  });

  if (!response.ok) {
    return handleErrorResponse<Blob>(response);
  }

  return response.blob();
}
