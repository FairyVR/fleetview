import { describe, expect, it } from 'vitest'
import {
  isOnline,
  ONLINE_WINDOW_MS,
  stationPlayerCounts,
  STATE_FRESH_MS
} from '../src/renderer/src/lib/presence'

const NOW = Date.parse('2026-07-19T16:00:00Z')

describe('isOnline', () => {
  it('last_login within the window = online', () => {
    expect(isOnline(NOW - 60_000, NOW)).toBe(true)
    expect(isOnline(NOW, NOW)).toBe(true)
  })

  it('last_login older than the window = offline', () => {
    expect(isOnline(NOW - ONLINE_WINDOW_MS - 1000, NOW)).toBe(false)
  })

  it('missing last_login = offline', () => {
    expect(isOnline(undefined, NOW)).toBe(false)
  })
})

function stateEvent(stationId: string, ageMs: number, players: number, idx = 1) {
  return {
    idx,
    event_type: 'state',
    station_id: stationId,
    timestamp: new Date(NOW - ageMs).toISOString(),
    event_data: JSON.stringify({ players: Array.from({ length: players }, (_, i) => ({ name: `p${i}` })) })
  }
}

describe('stationPlayerCounts', () => {
  it('takes the count from the freshest state event per station', () => {
    const counts = stationPlayerCounts(
      { items: [stateEvent('a', 10_000, 4, 2), stateEvent('a', 60_000, 9, 1), stateEvent('b', 15_000, 0)] },
      NOW
    )
    expect(counts.get('a')).toBe(4)
    expect(counts.get('b')).toBe(0) // fresh + empty = genuinely zero, not unknown
  })

  it('ignores stale events — missing means unknown', () => {
    const counts = stationPlayerCounts({ items: [stateEvent('a', STATE_FRESH_MS + 1000, 5)] }, NOW)
    expect(counts.has('a')).toBe(false)
  })

  it('tolerates garbage payloads', () => {
    expect(stationPlayerCounts(null, NOW).size).toBe(0)
    expect(stationPlayerCounts({ items: [{ event_type: 'state', station_id: 'a', timestamp: 'nope', event_data: '{bad' }] }, NOW).size).toBe(0)
    expect(
      stationPlayerCounts(
        { items: [{ event_type: 'gamemode_stopped', station_id: 'a', timestamp: new Date(NOW).toISOString(), event_data: '{"players":[{}]}' }] },
        NOW
      ).size
    ).toBe(0)
  })
})
