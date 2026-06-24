import { env } from '@/env';

/**
 * Default per-request timeout. The backend is a scale-to-zero Fly.io app, so the
 * first request after idle cold-starts and can take many seconds. We give it a
 * generous window before aborting so a cold start has a chance to wake up, but
 * still bound it so a stuck request can never hang the UI indefinitely.
 */
const DEFAULT_TIMEOUT_MS = 120_000;

/**
 * Normalise a FastAPI `.detail` payload into a human-readable string.
 *
 * FastAPI returns `.detail` in (at least) three shapes:
 *  - a plain string (e.g. raised `HTTPException(detail="...")`)
 *  - an array of validation errors on 422 (`[{ loc, msg, type }, ...]`)
 *  - a single error object with a `msg` field
 *
 * The array case is the one that previously rendered as "[object Object]";
 * here we join the `msg` fields into a readable message.
 */
export function detailMessage(detail: unknown): string | undefined {
  if (typeof detail === 'string') {
    return detail || undefined;
  }

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object' && 'msg' in item) {
          const msg = (item as { msg?: unknown }).msg;
          if (typeof msg === 'string') return msg;
        }
        return undefined;
      })
      .filter((msg): msg is string => Boolean(msg));
    return messages.length > 0 ? messages.join('; ') : undefined;
  }

  if (detail && typeof detail === 'object' && 'msg' in detail) {
    const msg = (detail as { msg?: unknown }).msg;
    if (typeof msg === 'string') return msg || undefined;
  }

  return undefined;
}

/** Error thrown by the api() wrapper on any non-2xx response. */
export class ApiError extends Error {
  /** HTTP status code returned by the backend. */
  public readonly status: number;
  /** Parsed `.detail` field from a FastAPI error body, when present. */
  public readonly detail: unknown;

  constructor(status: number, detail: unknown, message?: string) {
    super(message ?? detailMessage(detail) ?? `Request failed (${status})`);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

/**
 * Error thrown when a request is aborted by the timeout below (a likely
 * cold-start hang) rather than by the caller. Surfaces a friendly message
 * telling the user the backend may be waking up.
 */
export class ApiTimeoutError extends Error {
  constructor() {
    super('Request timed out — the backend may be waking up, try again.');
    this.name = 'ApiTimeoutError';
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

  // Abort the request if it hangs (likely a Fly.io cold start) so the UI can
  // surface a friendly message instead of spinning forever. We chain any
  // caller-supplied signal so external aborts still work.
  const controller = new AbortController();
  const callerSignal = init?.signal;
  if (callerSignal) {
    if (callerSignal.aborted) {
      controller.abort(callerSignal.reason);
    } else {
      callerSignal.addEventListener('abort', () => controller.abort(callerSignal.reason), {
        once: true,
      });
    }
  }
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, DEFAULT_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, { ...init, headers, signal: controller.signal });
  } catch (err) {
    // Distinguish our timeout abort from a caller abort or a network failure.
    if (timedOut) {
      throw new ApiTimeoutError();
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

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
