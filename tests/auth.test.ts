import { describe, it, expect } from 'vitest'
import { scopeToFlag, EMPTY_PERMISSIONS } from '../src/shared/models/auth'

describe('scopeToFlag', () => {
  it('maps known scopes', () => {
    expect(scopeToFlag('read')).toBe('read')
    expect(scopeToFlag('player-management')).toBe('playerManagement')
    expect(scopeToFlag('role-management')).toBe('roleManagement')
  })
  it('returns null for unknown / none', () => {
    expect(scopeToFlag('none')).toBeNull()
    expect(scopeToFlag('nonsense')).toBeNull()
  })
})

describe('EMPTY_PERMISSIONS', () => {
  it('is fully denied and undiscovered', () => {
    expect(EMPTY_PERMISSIONS.read).toBe(false)
    expect(EMPTY_PERMISSIONS.write).toBe(false)
    expect(EMPTY_PERMISSIONS.discoveredAt).toBe(0)
  })
})
