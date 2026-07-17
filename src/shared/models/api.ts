/** Transport-level models shared between the main process and the renderer. */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

/** Arguments the renderer passes to the API client to execute a registry endpoint. */
export interface ApiRequestArgs {
  endpointId: string
  /** Values for `:token` path params and `?query` params, keyed by param name. */
  params?: Record<string, string | number | boolean>
  /** JSON request body for write endpoints. */
  body?: unknown
  /** Optional override of the key used for this call; defaults to the active key. */
  keyId?: string
}

/** Result of an API call, safe to hand to the UI (never contains the raw key). */
export interface ApiResponse<T = unknown> {
  ok: boolean
  status: number
  statusText: string
  data: T | null
  /** Present when the call failed before/around the HTTP layer. */
  error?: ApiError
  /** Correlates to the RequestLogEntry recorded for this call. */
  logId: string
  durationMs: number
}

export type ApiErrorKind =
  | 'network'
  | 'timeout'
  | 'offline'
  | 'rate-limited'
  | 'auth-expired'
  | 'permission-denied'
  | 'not-found'
  | 'bad-response'
  | 'http-error'
  | 'unknown'

export interface ApiError {
  kind: ApiErrorKind
  message: string
  /** For permission-denied: the scope the key was missing. */
  missingPermission?: string
  /** For rate-limited: seconds to wait, if the server told us. */
  retryAfter?: number
  status?: number
}

/** A single recorded request/response pair for the Dev Mode API explorer. */
export interface RequestLogEntry {
  id: string
  timestamp: number
  endpointId: string
  endpointName: string
  method: HttpMethod
  url: string
  /** Params used to build the URL, retained so Dev Mode can replay the request. */
  params?: Record<string, string | number | boolean>
  /** Header names/values are sanitized — Authorization is shown as "Bearer ***". */
  requestHeaders: Record<string, string>
  requestBody: unknown
  responseStatus: number | null
  responseStatusText: string
  responseBody: unknown
  durationMs: number
  retries: number
  error?: ApiError
  keyId?: string
}

export interface LogFilter {
  text?: string
  method?: HttpMethod
  onlyErrors?: boolean
  endpointId?: string
}
