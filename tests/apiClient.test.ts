import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// In-memory stand-ins for the electron-backed stores (same pattern as keyService.test.ts).
const mem: Record<string, unknown> = {}
const fakeStore = { get: (k: string) => mem[k], set: (k: string, v: unknown) => (mem[k] = v) }
vi.mock('../src/main/stores', () => ({
  settingsStore: fakeStore,
  keysStore: fakeStore,
  permissionsStore: fakeStore
}))
vi.mock('../src/main/secure-storage', () => ({ readSecret: () => 'a.b.c' }))
vi.mock('../src/main/logger', () => ({ recordLog: () => {} }))

const { executeRequest } = await import('../src/main/api-client')

/** Minimal Response stand-in matching what api-client reads (status, headers.get, text()). */
function res(status: number, body: unknown, headers: Record<string, string> = {}) {
  return {
    status,
    statusText: String(status),
    headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body))
  }
}

const fetchMock = vi.fn()

beforeEach(() => {
  mem.baseUrl = 'https://api.oriondrift.net'
  mem.activeKeyId = 'k1'
  mem.requestTimeoutMs = 5000
  mem.maxRetries = 2
  mem.keys = [{ id: 'k1', name: 'k' }]
  mem.perms = {}
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

describe('executeRequest — happy path', () => {
  it('returns ok with parsed data and attaches the x-api-key header', async () => {
    fetchMock.mockResolvedValue(res(200, { items: [] }))
    const r = await executeRequest({ endpointId: 'fleet.list', keyId: 'k1', params: {} })
    expect(r.ok).toBe(true)
    expect(r.status).toBe(200)
    expect(r.data).toEqual({ items: [] })
    const [, opts] = fetchMock.mock.calls[0]
    expect((opts.headers as Record<string, string>)['x-api-key']).toBe('a.b.c')
  })
})

describe('executeRequest — error mapping', () => {
  it('names the full URL on a bare 404', async () => {
    fetchMock.mockResolvedValue(res(404, {}))
    const r = await executeRequest({ endpointId: 'fleet.list', keyId: 'k1', params: {} })
    expect(r.ok).toBe(false)
    expect(r.error?.kind).toBe('not-found')
    expect(r.error?.message).toContain('/v2/fleets')
  })

  it('remaps 401 "Invalid Permissions" to permission-denied (the live-API quirk)', async () => {
    fetchMock.mockResolvedValue(res(401, { error_name: 'Invalid Permissions', detail: 'fleet:read' }))
    const r = await executeRequest({ endpointId: 'fleet.list', keyId: 'k1', params: {} })
    expect(r.error?.kind).toBe('permission-denied')
    // surfaces the server's own detail (the exact missing scope)
    expect(r.error?.message).toContain('fleet:read')
  })

  it('classifies a fetch throw as a network error', async () => {
    mem.maxRetries = 0
    fetchMock.mockRejectedValue(new TypeError('fetch failed'))
    const r = await executeRequest({ endpointId: 'fleet.list', keyId: 'k1', params: {} })
    expect(r.ok).toBe(false)
    expect(r.error?.kind).toBe('network')
  })
})

describe('executeRequest — retries', () => {
  it('retries a 429 then succeeds', async () => {
    mem.maxRetries = 1
    fetchMock
      .mockResolvedValueOnce(res(429, {}, { 'retry-after': '0' }))
      .mockResolvedValueOnce(res(200, { ok: 1 }))
    const r = await executeRequest({ endpointId: 'fleet.list', keyId: 'k1', params: {} })
    expect(r.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe('executeRequest — permission pre-flight', () => {
  it('denies before fetch when explicit grants lack the scope', async () => {
    mem.perms = { k1: { grants: { f1: ['fleet:read'] }, discoveredAt: Date.now(), source: 'explicit' } }
    const r = await executeRequest({
      endpointId: 'moderation.ban',
      keyId: 'k1',
      params: { fleetId: 'f1', userId: 'u1' },
      body: { reason: 'x', duration_hours: 1 }
    })
    expect(r.error?.kind).toBe('permission-denied')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('never pre-flight-denies on probed (advisory) grants', async () => {
    mem.perms = { k1: { grants: { f1: ['fleet:read'] }, discoveredAt: Date.now(), source: 'probed' } }
    fetchMock.mockResolvedValue(res(200, { ok: 1 }))
    await executeRequest({
      endpointId: 'moderation.ban',
      keyId: 'k1',
      params: { fleetId: 'f1', userId: 'u1' },
      body: { reason: 'x', duration_hours: 1 }
    })
    expect(fetchMock).toHaveBeenCalled()
  })

  it('fails an auth endpoint with no key without hitting the network', async () => {
    mem.activeKeyId = null
    const r = await executeRequest({ endpointId: 'fleet.list', params: {} })
    expect(r.error?.kind).toBe('auth-expired')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
