import { describe, it, expect, vi, beforeEach } from 'vitest'

// In-memory stand-ins for the electron-backed stores.
const mem: Record<string, unknown> = { keys: [], perms: {}, activeKeyId: null }
const fakeStore = { get: (k: string) => mem[k], set: (k: string, v: unknown) => (mem[k] = v) }
vi.mock('../src/main/stores', () => ({
  keysStore: fakeStore,
  permissionsStore: fakeStore,
  settingsStore: fakeStore
}))

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
const FAKE_JWT = `${b64({ alg: 'none' })}.${b64({ user_id: '42' })}.sig`

vi.mock('../src/main/secure-storage', () => ({
  readSecret: () => FAKE_JWT,
  looksLikeJwt: () => true,
  saveSecret: () => '···',
  deleteSecret: () => {}
}))

const executeRequest = vi.fn()
vi.mock('../src/main/api-client', () => ({ executeRequest: (...a: unknown[]) => executeRequest(...a) }))

const { jwtUserId, discoverPermissions } = await import('../src/main/key-service')

const FLEET_LIST = { ok: true, status: 200, data: { items: [{ fleet_id: 'f1', stations: [] }] } }
const fail = { ok: false, status: 403, data: null }

beforeEach(() => {
  mem.keys = [{ id: 'k1', name: 'k' }]
  mem.perms = {}
  executeRequest.mockReset()
})

describe('jwtUserId', () => {
  it('pulls user_id from the JWT payload', () => {
    expect(jwtUserId(FAKE_JWT)).toBe('42')
  })
  it('returns null for garbage', () => {
    expect(jwtUserId('not-a-jwt')).toBeNull()
  })
})

describe('discoverPermissions via roles', () => {
  it('uses the key owner\'s role permissions when roles are readable', async () => {
    executeRequest.mockImplementation(async ({ endpointId }: { endpointId: string }) => {
      if (endpointId === 'fleet.list') return FLEET_LIST
      if (endpointId === 'roles.list')
        return { ok: true, status: 200, data: { roles: [{ role_id: 'r1', role_name: 'Mod', permissions: ['user_ban:write'] }] } }
      if (endpointId === 'roles.members')
        return { ok: true, status: 200, data: { users: [{ user_id: '42' }] } }
      return fail
    })
    const perms = await discoverPermissions('k1')
    expect(perms.grants.f1).toContain('user_ban:write')
    // roles path used — no read-endpoint probes fired
    expect(executeRequest.mock.calls.some(([r]) => r.endpointId === 'fleet.stations')).toBe(false)
  })

  it('falls back to endpoint probes when roles are unreadable', async () => {
    executeRequest.mockImplementation(async ({ endpointId }: { endpointId: string }) => {
      if (endpointId === 'fleet.list') return FLEET_LIST
      if (endpointId === 'fleet.stations') return { ok: true, status: 200, data: [] }
      return fail
    })
    const perms = await discoverPermissions('k1')
    expect(perms.grants.f1).toEqual(expect.arrayContaining(['fleet:read', 'station:read']))
  })

  it('falls back to probes when the user holds no roles', async () => {
    executeRequest.mockImplementation(async ({ endpointId }: { endpointId: string }) => {
      if (endpointId === 'fleet.list') return FLEET_LIST
      if (endpointId === 'roles.list')
        return { ok: true, status: 200, data: { roles: [{ role_id: 'r1', permissions: ['admin'] }] } }
      if (endpointId === 'roles.members') return { ok: true, status: 200, data: { users: [{ user_id: '99' }] } }
      if (endpointId === 'fleet.stations') return { ok: true, status: 200, data: [] }
      return fail
    })
    const perms = await discoverPermissions('k1')
    expect(perms.grants.f1).not.toContain('admin')
    expect(perms.grants.f1).toContain('station:read')
  })
})
