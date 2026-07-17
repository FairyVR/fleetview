import { describe, it, expect } from 'vitest'
import { buildUrl, searchEndpoints, getEndpoint, endpoints } from '../src/shared/registry'
import type { EndpointDef } from '../src/shared/registry/types'

const stationGet = getEndpoint('station.get') as EndpointDef

describe('buildUrl', () => {
  it('substitutes path params', () => {
    const { path, missing } = buildUrl(stationGet, { stationId: 'stn_1' })
    expect(path).toBe('/v1/stations/stn_1')
    expect(missing).toEqual([])
  })

  it('reports missing required path params', () => {
    const { missing } = buildUrl(stationGet, {})
    expect(missing).toContain('stationId')
  })

  it('appends query params and encodes values', () => {
    const search = getEndpoint('player.search') as EndpointDef
    const { path } = buildUrl(search, { q: 'nova blade' })
    expect(path).toBe('/v1/players?q=nova+blade')
  })

  it('omits optional query params when absent', () => {
    const search = getEndpoint('player.search') as EndpointDef
    const { path, missing } = buildUrl(search, {})
    expect(path).toBe('/v1/players')
    expect(missing).toEqual([])
  })

  it('encodes path param values', () => {
    const { path } = buildUrl(stationGet, { stationId: 'a/b c' })
    expect(path).toBe('/v1/stations/a%2Fb%20c')
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
