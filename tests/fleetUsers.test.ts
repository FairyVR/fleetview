// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { roleTokens, userHasRole, type FleetUser } from '../src/renderer/src/lib/fleetUsers'

describe('roleTokens (varying role-entry shapes)', () => {
  it('reads bare id/name strings', () => {
    expect(roleTokens('rol_1')).toEqual(['rol_1'])
  })
  it('reads snake_case role objects', () => {
    expect(roleTokens({ role_id: 'rol_1', role_name: 'Admin' })).toEqual(['rol_1', 'Admin'])
  })
  it('reads plain id/name objects (the shape that used to map to "")', () => {
    expect(roleTokens({ id: 'rol_1', name: 'Admin' })).toEqual(['rol_1', 'Admin'])
  })
  it('ignores null/empty entries', () => {
    expect(roleTokens(null)).toEqual([])
  })
})

describe('userHasRole (id or name, case-insensitive)', () => {
  const user: FleetUser = { id: 'u1', name: 'Nova', roles: ['rol_1', 'Admin'] }
  it('matches by id', () => {
    expect(userHasRole(user, { id: 'rol_1', name: 'Admin' })).toBe(true)
  })
  it('matches by name only, case-insensitively', () => {
    expect(userHasRole({ ...user, roles: ['admin'] }, { id: 'rol_x', name: 'Admin' })).toBe(true)
  })
  it('does not match unrelated roles', () => {
    expect(userHasRole(user, { id: 'rol_2', name: 'Moderator' })).toBe(false)
  })
})
