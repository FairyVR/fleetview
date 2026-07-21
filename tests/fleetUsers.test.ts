// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'

// api.ts reads window.api at import time, so stub it before importing the module under test.
const request = vi.fn()
;(globalThis as unknown as { window: Record<string, unknown> }).window ??= {}
;(window as unknown as { api: unknown }).api = { request }

const { loadUserRoles, loadRoleMembers } = await import('../src/renderer/src/lib/fleetUsers')

beforeEach(() => request.mockReset())

describe('loadRoleMembers', () => {
  it('coerces the live { users: [...] } wrapper into id/name', async () => {
    request.mockResolvedValue({ data: { users: [{ user_id: 'u1', username: 'Nova' }] } })
    expect(await loadRoleMembers('flt', 'r1')).toEqual([{ id: 'u1', name: 'Nova' }])
  })
  it('also accepts an items[] wrapper', async () => {
    request.mockResolvedValue({ data: { items: [{ user_id: 'u3', username: 'Ivy' }] } })
    expect(await loadRoleMembers('flt', 'r1')).toEqual([{ id: 'u3', name: 'Ivy' }])
  })
  it('tolerates a bare array', async () => {
    request.mockResolvedValue({ data: [{ user_id: 'u2', username: 'Rex' }] })
    expect(await loadRoleMembers('flt', 'r1')).toEqual([{ id: 'u2', name: 'Rex' }])
  })
})

describe('loadUserRoles (cross-reference over role member lists)', () => {
  it('returns only the roles whose member list contains the user', async () => {
    request.mockImplementation((args) => {
      const { endpointId, params } = args ?? {}
      if (endpointId === 'roles.list')
        return Promise.resolve({
          data: {
            roles: [
              { role_id: 'r1', role_name: 'Admin', permissions: ['user_ban:write'] },
              { role_id: 'r2', role_name: 'Mod' }
            ]
          }
        })
      const members = params?.roleId === 'r1' ? [{ user_id: 'u1' }] : [{ user_id: 'u9' }]
      return Promise.resolve({ data: { items: members } })
    })
    expect(await loadUserRoles('flt', 'u1')).toEqual([
      { id: 'r1', name: 'Admin', permissions: ['user_ban:write'] }
    ])
  })
})
