import { describe, it, expect } from 'vitest'
import { buildUrl, searchEndpoints, getEndpoint, endpoints } from '../src/shared/registry'
import type { EndpointDef } from '../src/shared/registry/types'

const stationGet = getEndpoint('station.get') as EndpointDef
const playerSearch = getEndpoint('player.search') as EndpointDef

describe('buildUrl', () => {
  it('substitutes path params', () => {
    const { path, missing } = buildUrl(stationGet, { stationId: 'stn_1' })
    expect(path).toBe('/v2/stations/stn_1')
    expect(missing).toEqual([])
  })

  it('reports missing required path params', () => {
    const { missing } = buildUrl(stationGet, {})
    expect(missing).toContain('stationId')
  })

  it('appends query params and encodes values', () => {
    const { path } = buildUrl(playerSearch, { search_string: 'nova blade' })
    expect(path).toBe('/v1/user_search?search_string=nova+blade')
  })

  it('omits optional query params when absent', () => {
    const { path, missing } = buildUrl(playerSearch, {})
    expect(path).toBe('/v1/user_search')
    expect(missing).toEqual([])
  })

  it('encodes path param values', () => {
    const { path } = buildUrl(stationGet, { stationId: 'a/b c' })
    expect(path).toBe('/v2/stations/a%2Fb%20c')
  })

  it('substitutes multiple path params (fleet + user + role)', () => {
    const assign = getEndpoint('roles.assign') as EndpointDef
    const { path, missing } = buildUrl(assign, { fleetId: 'flt_1', userId: 'usr_1', roleId: 'rol_1' })
    expect(path).toBe('/v1/fleets/flt_1/users/usr_1/roles/rol_1')
    expect(missing).toEqual([])
  })
})

describe('searchEndpoints', () => {
  it('returns all for empty query', () => {
    expect(searchEndpoints('')).toHaveLength(endpoints.length)
  })
  it('matches by id, name, or path', () => {
    const results = searchEndpoints('ban')
    expect(results.some((e) => e.id === 'moderation.ban')).toBe(true)
  })
  it('is case-insensitive', () => {
    expect(searchEndpoints('FLEET').length).toBeGreaterThan(0)
  })
})

describe('registry integrity (real Orion Drift API)', () => {
  it('has unique endpoint ids', () => {
    const ids = endpoints.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('contains no placeholder/example hosts or paths', () => {
    for (const e of endpoints) {
      expect(e.path.startsWith('/')).toBe(true)
      expect(e.path).not.toMatch(/example|placeholder|orion-drift\./i)
    }
  })

  it('declares every :token in a path as a param', () => {
    for (const e of endpoints) {
      const tokens = [...e.path.matchAll(/:([A-Za-z0-9_]+)/g)].map((m) => m[1])
      const declared = new Set((e.params ?? []).filter((p) => p.in === 'path').map((p) => p.name))
      for (const t of tokens) {
        expect(declared.has(t), `${e.id} missing param "${t}"`).toBe(true)
      }
    }
  })

  it('every declared path param appears in its path', () => {
    for (const e of endpoints) {
      for (const p of (e.params ?? []).filter((x) => x.in === 'path')) {
        expect(e.path.includes(`:${p.name}`), `${e.id} declares unused param "${p.name}"`).toBe(true)
      }
    }
  })

  it('all endpoints require auth (the API rejects anonymous calls with 403)', () => {
    for (const e of endpoints) expect(e.requiresAuth).toBe(true)
  })
})
