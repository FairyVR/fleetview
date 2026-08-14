import { describe, expect, it } from 'vitest'
import {
  accessLabel,
  fleetAccess,
  isManageable,
  sortByAccess
} from '../src/renderer/src/lib/fleetAccess'

describe('isManageable', () => {
  it('keeps admin and elevated fleets', () => {
    expect(isManageable(['admin'])).toBe(true)
    expect(isManageable(['fleet:read', 'station_config:write'])).toBe(true)
    expect(isManageable(['fleet:read', 'user_ban:write'])).toBe(true)
  })

  it('drops fleets probed down to baseline reads', () => {
    expect(isManageable(['fleet:read', 'station:read'])).toBe(false)
    expect(isManageable([])).toBe(false)
  })

  it('keeps unprobed fleets — an unknown grant is not a denial', () => {
    expect(isManageable(undefined)).toBe(true)
  })
})

describe('fleetAccess', () => {
  it('an unprobed fleet is unknown, never denied', () => {
    const a = fleetAccess(undefined)
    expect(a.tier).toBe('unknown')
    expect(a.moderation).toBe(false)
    expect(a.configuration).toBe(false)
  })

  it('admin implies both purposes', () => {
    const a = fleetAccess(['admin'])
    expect(a).toMatchObject({ tier: 'admin', moderation: true, configuration: true })
  })

  it('baseline-only scopes are read, not elevated', () => {
    // Exactly what the cheap discovery pass seeds plus its read probes.
    expect(fleetAccess(['fleet:read', 'role:read', 'station:read', 'server_event:read']).tier).toBe('read')
    expect(fleetAccess([]).tier).toBe('read')
  })

  it('recognizes moderation scopes', () => {
    for (const s of ['user_data:read', 'fleet_report:read', 'user_ban:write', 'user_roles:write']) {
      const a = fleetAccess(['fleet:read', s])
      expect(a.tier, s).toBe('elevated')
      expect(a.moderation, s).toBe(true)
      expect(a.configuration, s).toBe(false)
    }
  })

  it('recognizes configuration scopes', () => {
    for (const s of ['fleet_config:read', 'station_config:write', 'station:write', 'fleet:write']) {
      const a = fleetAccess(['fleet:read', s])
      expect(a.tier, s).toBe('elevated')
      expect(a.configuration, s).toBe(true)
      expect(a.moderation, s).toBe(false)
    }
  })

  it('reports both purposes at once', () => {
    const a = fleetAccess(['fleet:read', 'user_data:read', 'station_config:write'])
    expect(a.moderation && a.configuration).toBe(true)
    expect(a.extra.sort()).toEqual(['station_config:write', 'user_data:read'])
  })

  it('strips baseline scopes from extra', () => {
    expect(fleetAccess(['fleet:read', 'station:read', 'user_data:read']).extra).toEqual(['user_data:read'])
  })
})

describe('accessLabel', () => {
  it('names each tier', () => {
    expect(accessLabel(fleetAccess(['admin']))).toBe('admin — full access')
    expect(accessLabel(fleetAccess(undefined))).toBe('access not probed')
    expect(accessLabel(fleetAccess(['fleet:read']))).toBe('read-only')
    expect(accessLabel(fleetAccess(['user_data:read']))).toBe('moderation')
    expect(accessLabel(fleetAccess(['station_config:write']))).toBe('config')
    expect(accessLabel(fleetAccess(['user_data:read', 'fleet_config:read']))).toBe('moderation + config')
  })
})

describe('sortByAccess', () => {
  const fleets = [
    { id: 'read', name: 'Zulu' },
    { id: 'unknown', name: 'Yankee' },
    { id: 'mod', name: 'Xray' },
    { id: 'admin', name: 'Whiskey' }
  ]
  const grants = {
    read: ['fleet:read'],
    mod: ['fleet:read', 'user_data:read'],
    admin: ['admin']
    // 'unknown' deliberately absent
  }

  it('orders admin, elevated, unprobed, read-only', () => {
    expect(sortByAccess(fleets, grants).map((f) => f.id)).toEqual(['admin', 'mod', 'unknown', 'read'])
  })

  it('sorts alphabetically within a tier and does not drop anything', () => {
    const many = [
      { id: 'a', name: 'Beta' },
      { id: 'b', name: 'Alpha' }
    ]
    const out = sortByAccess(many, { a: ['admin'], b: ['admin'] })
    expect(out.map((f) => f.name)).toEqual(['Alpha', 'Beta'])
    expect(sortByAccess(fleets, {})).toHaveLength(fleets.length)
  })

  it('leaves the input array untouched', () => {
    const input = [...fleets]
    sortByAccess(input, grants)
    expect(input.map((f) => f.id)).toEqual(fleets.map((f) => f.id))
  })
})
