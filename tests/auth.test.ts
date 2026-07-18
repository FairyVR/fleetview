import { describe, it, expect } from 'vitest'
import {
  hasScope,
  fleetHasScope,
  isDiscovered,
  parseGrants,
  mergeProbedScopes,
  EMPTY_PERMISSIONS
} from '../src/shared/models/auth'
import type { PermissionSet } from '../src/shared/models/auth'

const perms: PermissionSet = {
  grants: {
    'Strike Tournament': ['admin', 'fleet:join', 'user_kick'],
    Strike: ['fleet:join', 'fleet:read', 'station_config:read', 'station_config:write']
  },
  discoveredAt: 1
}

describe('per-fleet permission model', () => {
  it('admin grants every scope within its fleet', () => {
    expect(hasScope(perms, 'user_ban:write', 'Strike Tournament')).toBe(true)
    expect(hasScope(perms, 'station_config:write', 'Strike Tournament')).toBe(true)
  })

  it('non-admin fleets only grant listed scopes', () => {
    expect(hasScope(perms, 'station_config:write', 'Strike')).toBe(true)
    expect(hasScope(perms, 'user_ban:write', 'Strike')).toBe(false)
  })

  it('without a fleetId, any fleet granting the scope suffices', () => {
    expect(hasScope(perms, 'station_config:write')).toBe(true)
    // admin in Strike Tournament satisfies arbitrary scopes fleet-agnostically
    expect(hasScope(perms, 'user_ban:revoke')).toBe(true)
  })

  it('unknown fleetId falls back to any-fleet check (stations do not name their fleet)', () => {
    expect(hasScope(perms, 'fleet:read', 'SomeOtherFleet')).toBe(true)
  })

  it('fleetHasScope treats admin as wildcard', () => {
    expect(fleetHasScope(['admin'], 'anything:at all')).toBe(true)
    expect(fleetHasScope(['fleet:read'], 'fleet:write')).toBe(false)
  })

  it('EMPTY_PERMISSIONS is undiscovered and denies nothing implicitly', () => {
    expect(isDiscovered(EMPTY_PERMISSIONS)).toBe(false)
    expect(hasScope(EMPTY_PERMISSIONS, 'fleet:read')).toBe(false)
  })

  it('isDiscovered rejects legacy/degenerate shapes', () => {
    expect(isDiscovered(undefined)).toBe(false)
    expect(isDiscovered({ grants: {}, discoveredAt: 5 })).toBe(false)
    // legacy flat shape from an older version: no grants key
    expect(isDiscovered({ discoveredAt: 5 } as unknown as PermissionSet)).toBe(false)
  })
})

describe('probed permission sets (advisory only)', () => {
  // Mirrors the guard in api-client checkPermission and useAppStore permissionState:
  // only source === 'explicit' may ever deny; probed absence proves nothing.
  const probed: PermissionSet = {
    grants: { flt_1: ['fleet:read', 'station:read'] },
    discoveredAt: 1,
    source: 'probed'
  }

  it('is discovered (so the UI can display it)', () => {
    expect(isDiscovered(probed)).toBe(true)
  })

  it('the deny guard treats non-explicit sources as unknown', () => {
    const mayDeny = (p: PermissionSet) => p.source === 'explicit'
    expect(mayDeny(probed)).toBe(false)
    expect(mayDeny({ ...probed, source: 'explicit' })).toBe(true)
    // legacy persisted sets without a source must not deny either
    expect(mayDeny({ grants: { A: ['fleet:read'] }, discoveredAt: 1 })).toBe(false)
  })
})

describe('mergeProbedScopes', () => {
  it('widens one fleet without touching others and dedupes', () => {
    const prev: PermissionSet = {
      grants: { A: ['fleet:read', 'station:read'], B: ['fleet:read'] },
      discoveredAt: 1,
      source: 'probed'
    }
    const merged = mergeProbedScopes(prev, 'A', ['fleet:read', 'fleet_config:write'])
    expect(merged.grants.A.sort()).toEqual(['fleet:read', 'fleet_config:write', 'station:read'].sort())
    expect(merged.grants.B).toEqual(['fleet:read'])
    expect(merged.source).toBe('probed')
    expect(merged.discoveredAt).toBeGreaterThan(1)
  })

  it('starts from empty/undefined and adds the fleet', () => {
    const merged = mergeProbedScopes(undefined, 'F', ['fleet:read'])
    expect(merged.grants).toEqual({ F: ['fleet:read'] })
    expect(merged.source).toBe('probed')
    expect(isDiscovered(merged)).toBe(true)
  })

  it('preserves an explicit source (never downgrades deniability rules)', () => {
    const prev: PermissionSet = { grants: { A: ['fleet:read'] }, discoveredAt: 1, source: 'explicit' }
    expect(mergeProbedScopes(prev, 'A', ['station:read']).source).toBe('explicit')
  })
})

describe('parseGrants', () => {
  it('parses a fleet->scopes map', () => {
    expect(parseGrants({ permissions: { A: ['fleet:read'], B: ['admin'] } })).toEqual({
      A: ['fleet:read'],
      B: ['admin']
    })
  })

  it('parses an array of fleet objects', () => {
    expect(
      parseGrants({ fleets: [{ name: 'A', permissions: ['fleet:read', 'user_kick'] }] })
    ).toEqual({ A: ['fleet:read', 'user_kick'] })
  })

  it('parses a flat scope list under a wildcard fleet', () => {
    expect(parseGrants({ scopes: ['fleet:read'] })).toEqual({ '*': ['fleet:read'] })
  })

  it('returns null for garbage (must NOT produce a deny-all set)', () => {
    expect(parseGrants(null)).toBeNull()
    expect(parseGrants('nope')).toBeNull()
    expect(parseGrants({ message: 'error' })).toBeNull()
  })
})
