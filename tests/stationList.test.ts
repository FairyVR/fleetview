import { describe, it, expect } from 'vitest'
import { mergeOfflineStations, visibleStations } from '../src/renderer/src/lib/stationList'
import type { Station } from '../src/shared/models'

const active: Station[] = [
  { id: 'a', fleetId: 'f1', name: 'Alpha', status: 'online', region: 'eu-central-1', playerCount: 3 },
  { id: 'b', fleetId: 'f1', name: 'Bravo', status: 'offline' }
]

const offline = (id: string, name: string): Station => ({
  id,
  fleetId: 'f1',
  name,
  status: 'offline',
  region: 'us-east-2'
})

describe('mergeOfflineStations', () => {
  it('adds stations the active response never returned', () => {
    const merged = mergeOfflineStations(active, [offline('c', 'Charlie')])
    expect(merged).toHaveLength(3)
    expect(merged[2]).toMatchObject({ id: 'c', name: 'Charlie', status: 'offline', region: 'us-east-2' })
  })

  it('never duplicates or downgrades a station that is already active', () => {
    const merged = mergeOfflineStations(active, [offline('a', 'Alpha')])
    expect(merged).toHaveLength(2)
    expect(merged[0].status).toBe('online')
    expect(merged[0].playerCount).toBe(3)
  })

  it('works when the active list is empty — a fleet with nothing running', () => {
    const merged = mergeOfflineStations([], [offline('c', 'Charlie'), offline('d', 'Delta')])
    expect(merged.map((s) => s.id)).toEqual(['c', 'd'])
  })

  it('skips entries with no id', () => {
    expect(mergeOfflineStations([], [offline('', 'ghost')])).toHaveLength(0)
  })
})

describe('visibleStations', () => {
  it('hides offline stations by default', () => {
    expect(visibleStations(active, false).map((s) => s.id)).toEqual(['a'])
  })

  it('shows everything when asked', () => {
    expect(visibleStations(active, true)).toHaveLength(2)
  })
})
