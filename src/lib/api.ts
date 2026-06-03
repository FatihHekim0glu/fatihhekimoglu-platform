import { env } from '@/env';

/** Error thrown by the api() wrapper on any non-2xx response. */
export class ApiError extends Error {
  /** HTTP status code returned by the backend. */
  public readonly status: number;
  /** Parsed `.detail` field from a FastAPI error body, when present. */
  public readonly detail: unknown;

  constructor(status: number, detail: unknown, message?: string) {
    super(message ?? (typeof detail === 'string' ? detail : `Request failed (${status})`));
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

function joinUrl(base: string, path: string): string {
  const trimmedBase = base.replace(/\/+$/, '');
  const trimmedPath = path.startsWith('/') ? path : `/${path}`;
  return `${trimmedBase}${trimmedPath}`;
}

/**
 * Typed fetch wrapper around the FastAPI backend at NEXT_PUBLIC_BACKEND_URL.
 * Throws {@link ApiError} on any non-2xx response, surfacing FastAPI's `.detail`.
 */
export async function api<TResp>(path: string, init?: RequestInit): Promise<TResp> {
  const url = joinUrl(env.NEXT_PUBLIC_BACKEND_URL, path);

  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }
  headers.set('accept', 'application/json');

  const res = await fetch(url, { ...init, headers });

  let body: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!res.ok) {
    const detail =
      body && typeof body === 'object' && body !== null && 'detail' in body
        ? (body as { detail: unknown }).detail
        : body;
    throw new ApiError(res.status, detail);
  }

  return body as TResp;
}

/** GET helper. Forwards `init` so callers can override caching or signals. */
export function apiGet<TResp>(path: string, init?: RequestInit): Promise<TResp> {
  return api<TResp>(path, { ...init, method: 'GET' });
}

/** POST helper. `body` is JSON-encoded automatically. */
export function apiPost<TResp>(
  path: string,
  body: unknown,
  init?: RequestInit,
): Promise<TResp> {
  return api<TResp>(path, {
    ...init,
    method: 'POST',
    body: JSON.stringify(body),
  });
}
