import { describe, it, expect } from 'vitest'
import { normalizeBaseUrl } from '../src/shared/registry'

describe('normalizeBaseUrl', () => {
  it('strips trailing slashes and a stale version segment', () => {
    expect(normalizeBaseUrl('https://api.oriondrift.net')).toBe('https://api.oriondrift.net')
    expect(normalizeBaseUrl('https://api.oriondrift.net/')).toBe('https://api.oriondrift.net')
    expect(normalizeBaseUrl('https://api.oriondrift.net/v2')).toBe('https://api.oriondrift.net')
    expect(normalizeBaseUrl('https://api.oriondrift.net/v1/')).toBe('https://api.oriondrift.net')
  })
})
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

  it('builds the exact fleet-list request the dashboard makes', () => {
    const list = getEndpoint('fleet.list') as EndpointDef
    const { path, missing } = buildUrl(list, {
      include_config: true,
      include_stations: true,
      include_offline_fleets: false,
      page_size: 32,
      page: 1
    })
    expect(missing).toEqual([])
    expect(path).toBe(
      '/v2/fleets?include_config=true&include_stations=true&include_offline_fleets=false&page=1&page_size=32'
    )
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

  it('carries the live-probed v2 endpoints as verified', () => {
    for (const [id, path] of [
      ['station.list', '/v2/stations'],
      ['fleet.stations', '/v2/fleets/:fleetId/stations'],
      ['user.get', '/v2/users/:userId'],
      ['events.station', '/v2/stations/:stationId/server_events'],
      ['station.config.get', '/v2/stations/:stationId/config'],
      ['moderation.bans', '/v2/fleets/:fleetId/bans']
    ]) {
      const e = getEndpoint(id) as EndpointDef
      expect(e, id).toBeDefined()
      expect(e.path).toBe(path)
      expect(e.status).toBe('verified')
    }
  })

  it('marks paths whose v2 equivalents 404d as unverified', () => {
    for (const id of ['fleet.get', 'fleet.update', 'roles.create']) {
      expect((getEndpoint(id) as EndpointDef).status, id).toBe('unverified')
    }
  })

  it('keeps live-verified 2026-07-18 endpoints verified', () => {
    for (const [id, path] of [
      ['roles.list', '/v1/fleets/:fleetId/roles'],
      ['player.listByFleet', '/v3/fleets/:fleetId/users']
    ]) {
      const e = getEndpoint(id) as EndpointDef
      expect(e.path, id).toBe(path)
      expect(e.status, id).toBe('verified')
    }
  })
})
