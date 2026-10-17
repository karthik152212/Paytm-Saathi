/**
 * Thin fetch wrapper for the /api layer.
 *
 * - Same-origin `/api` paths, served by Vite's dev proxy to FastAPI (:8000)
 *   in development and by the hosting rewriter in a real deployment.
 * - Throws `ApiError` for every failure; `status === 0` means the network
 *   itself was unreachable (backend not running / offline), which callers
 *   use to switch the UI into local-only mode.
 */

export type ApiStatus = 'connecting' | 'online' | 'offline'

export const DEFAULT_USER_ID = 'usr_001'

const BASE = '/api'

export class ApiError extends Error {
  readonly status: number
  readonly detail: string

  constructor(message: string, status: number, detail = '') {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }

  /**
   * True when the backend could not be reached: a transport failure (0), or a
   * 5xx from the dev proxy when FastAPI is not running. 4xx means the backend
   * answered — the app is online, the request was just not allowed.
   */
  get isUnavailable(): boolean {
    return this.status === 0 || this.status >= 500
  }
}

async function parseError(response: Response): Promise<ApiError> {
  let detail = ''
  try {
    const body: unknown = await response.json()
    if (body && typeof body === 'object' && 'detail' in body) {
      const raw = (body as { detail: unknown }).detail
      detail = typeof raw === 'string' ? raw : JSON.stringify(raw)
    }
  } catch {
    /* non-JSON error body — status alone is enough */
  }
  return new ApiError(`${response.status} ${response.statusText}`, response.status, detail)
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${BASE}${path}`, {
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
      ...init,
    })
  } catch {
    throw new ApiError('Backend unreachable', 0)
  }
  if (!response.ok) throw await parseError(response)
  if (response.status === 204) return undefined as T
  try {
    return (await response.json()) as T
  } catch {
    throw new ApiError('Invalid JSON from backend', response.status)
  }
}

export function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  return request<T>(path, { method: 'GET', signal })
}

export function apiPost<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  return request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body), signal })
}

export function apiPatch<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  return request<T>(path, { method: 'PATCH', body: JSON.stringify(body), signal })
}

export function apiDelete<T = void>(path: string, signal?: AbortSignal): Promise<T> {
  return request<T>(path, { method: 'DELETE', signal })
}
