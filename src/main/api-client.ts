import { randomUUID } from 'node:crypto'
import type {
  ApiError,
  ApiRequestArgs,
  ApiResponse,
  RequestLogEntry,
  PermissionSet
} from '@shared/models'
import { hasScope, isDiscovered } from '@shared/models'
import { getEndpoint, buildUrl } from '@shared/registry'
import { settingsStore, keysStore, permissionsStore } from './stores'
import { readSecret } from './secure-storage'
import { recordLog } from './logger'

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504])

/** Sleep helper for backoff. */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Turn a header map into a log-safe copy (mask Authorization). */
function sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(headers)) {
    out[k] = k.toLowerCase() === 'authorization' ? 'Bearer ***' : v
  }
  return out
}

/**
 * Pre-flight permission check against the key's discovered per-fleet grants.
 * Only denies when discovery genuinely succeeded AND no fleet (or the specific fleet,
 * when a fleetId param is present) grants the scope. "admin" in a fleet grants all.
 * Unknown/failed discovery NEVER blocks — the server is the authority.
 */
function checkPermission(
  keyId: string | null,
  scope: string,
  params?: Record<string, string | number | boolean>
): ApiError | null {
  if (scope === 'none' || !keyId) return null
  const perms: PermissionSet | undefined = permissionsStore.get('perms')[keyId]
  if (!isDiscovered(perms)) return null
  const fleetId = params?.fleetId !== undefined ? String(params.fleetId) : undefined
  if (hasScope(perms, scope, fleetId)) return null
  return {
    kind: 'permission-denied',
    message: fleetId
      ? `The active key is missing "${scope}" for fleet "${fleetId}".`
      : `The active key is missing "${scope}" in every fleet it can access.`,
    missingPermission: scope
  }
}

function touchKeyLastUsed(keyId: string): void {
  const keys = keysStore.get('keys')
  const k = keys.find((x) => x.id === keyId)
  if (k) {
    k.lastUsedAt = Date.now()
    keysStore.set('keys', keys)
  }
}

/** Classify a fetch/parse failure into a typed ApiError. */
function classifyThrow(err: unknown): ApiError {
  const msg = err instanceof Error ? err.message : String(err)
  if (err instanceof Error && err.name === 'AbortError') {
    return { kind: 'timeout', message: 'Request timed out.' }
  }
  // Node fetch throws TypeError for network/DNS failures.
  if (/ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|fetch failed|network/i.test(msg)) {
    return { kind: 'network', message: `Network error: ${msg}` }
  }
  return { kind: 'unknown', message: msg }
}

/** Map an HTTP status to a typed error (or null for success statuses). */
function errorForStatus(status: number, retryAfter?: number): ApiError | null {
  if (status >= 200 && status < 300) return null
  switch (status) {
    case 401:
      return { kind: 'auth-expired', message: 'Authentication failed or expired.', status }
    case 403:
      return { kind: 'permission-denied', message: 'The key lacks permission for this action.', status }
    case 404:
      return { kind: 'not-found', message: 'Resource not found.', status }
    case 429:
      return { kind: 'rate-limited', message: 'Rate limited.', status, retryAfter }
    default:
      return { kind: 'http-error', message: `HTTP ${status}.`, status }
  }
}

export async function executeRequest(args: ApiRequestArgs): Promise<ApiResponse> {
  const started = Date.now()
  const logId = randomUUID()
  const endpoint = getEndpoint(args.endpointId)

  const baseLog: RequestLogEntry = {
    id: logId,
    timestamp: started,
    endpointId: args.endpointId,
    endpointName: endpoint?.name ?? args.endpointId,
    method: endpoint?.method ?? 'GET',
    url: '',
    params: args.params,
    requestHeaders: {},
    requestBody: args.body ?? null,
    responseStatus: null,
    responseStatusText: '',
    responseBody: null,
    durationMs: 0,
    retries: 0,
    keyId: args.keyId ?? settingsStore.get('activeKeyId') ?? undefined
  }

  const fail = (error: ApiError, retries = 0): ApiResponse => {
    recordLog({ ...baseLog, error, retries, durationMs: Date.now() - started })
    return { ok: false, status: 0, statusText: '', data: null, error, logId, durationMs: Date.now() - started }
  }

  if (!endpoint) {
    return fail({ kind: 'bad-response', message: `Unknown endpoint id: ${args.endpointId}` })
  }

  const keyId = args.keyId ?? settingsStore.get('activeKeyId')

  // Auth requirement.
  if (endpoint.requiresAuth && !keyId) {
    return fail({ kind: 'auth-expired', message: 'No API key selected. Add and activate a key first.' })
  }

  // Permission pre-flight (do not attempt if we know the key can't do it).
  const permErr = checkPermission(keyId, endpoint.permission, args.params)
  if (permErr) return fail(permErr)

  // Build URL.
  const baseUrl = settingsStore.get('baseUrl').replace(/\/+$/, '')
  const { path, missing } = buildUrl(endpoint, args.params)
  if (missing.length) {
    return fail({ kind: 'bad-response', message: `Missing required params: ${missing.join(', ')}` })
  }
  const url = `${baseUrl}${path}`
  baseLog.url = url

  // Headers.
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (endpoint.requiresAuth && keyId) {
    const secret = readSecret(keyId)
    if (!secret) return fail({ kind: 'auth-expired', message: 'Stored key secret could not be read.' })
    headers.Authorization = `Bearer ${secret}`
  }
  const hasBody = args.body !== undefined && endpoint.method !== 'GET'
  if (hasBody) headers['Content-Type'] = 'application/json'
  baseLog.requestHeaders = sanitizeHeaders(headers)

  const timeoutMs = settingsStore.get('requestTimeoutMs')
  const maxRetries = settingsStore.get('maxRetries')

  let retries = 0
  let lastError: ApiError | null = null

  while (retries <= maxRetries) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(url, {
        method: endpoint.method,
        headers,
        body: hasBody ? JSON.stringify(args.body) : undefined,
        signal: controller.signal
      })
      clearTimeout(timer)

      const retryAfter = Number(res.headers.get('retry-after')) || undefined
      const text = await res.text()
      let data: unknown = null
      if (text) {
        try {
          data = JSON.parse(text)
        } catch {
          // Malformed JSON — surface raw text rather than throwing.
          data = { _raw: text }
        }
      }

      const statusErr = errorForStatus(res.status, retryAfter)

      if (statusErr && RETRYABLE_STATUS.has(res.status) && retries < maxRetries) {
        lastError = statusErr
        retries++
        const backoff = retryAfter ? retryAfter * 1000 : 300 * 2 ** (retries - 1)
        await sleep(backoff)
        continue
      }

      if (keyId) touchKeyLastUsed(keyId)
      const durationMs = Date.now() - started
      recordLog({
        ...baseLog,
        responseStatus: res.status,
        responseStatusText: res.statusText,
        responseBody: data,
        durationMs,
        retries,
        error: statusErr ?? undefined
      })
      return {
        ok: !statusErr,
        status: res.status,
        statusText: res.statusText,
        data,
        error: statusErr ?? undefined,
        logId,
        durationMs
      }
    } catch (err) {
      clearTimeout(timer)
      lastError = classifyThrow(err)
      if ((lastError.kind === 'network' || lastError.kind === 'timeout') && retries < maxRetries) {
        retries++
        await sleep(300 * 2 ** (retries - 1))
        continue
      }
      return fail(lastError, retries)
    }
  }

  return fail(lastError ?? { kind: 'unknown', message: 'Request failed.' }, retries)
}
