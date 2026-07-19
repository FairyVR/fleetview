import { describe, expect, it } from 'vitest'
import { onlineNames, PRESENCE_MAX_AGE_MS } from '../src/renderer/src/lib/presence'

const NOW = Date.parse('2026-07-19T16:00:00Z')

function stateEvent(names: string[], iso: string, type = 'state') {
  return {
    idx: 1,
    event_type: type,
    station_id: 'st_1',
    timestamp: iso,
    event_data: JSON.stringify({ players: names.map((n) => ({ name: n, player_index: 1 })) })
  }
}

describe('onlineNames', () => {
  it('collects lowercased names from fresh state events', () => {
    const data = { items: [stateEvent(['MoonwaIk', 'Fairy'], '2026-07-19T15:58:00Z')] }
    expect(onlineNames(data, NOW)).toEqual(new Set(['moonwaik', 'fairy']))
  })

  it('ignores stale state events', () => {
    const old = new Date(NOW - PRESENCE_MAX_AGE_MS - 1000).toISOString()
    const data = { items: [stateEvent(['Ghost'], old)] }
    expect(onlineNames(data, NOW).size).toBe(0)
  })

  it('ignores non-state events and unparseable event_data', () => {
    const data = {
      items: [
        stateEvent(['Runner'], '2026-07-19T15:59:00Z', 'gamemode_stopped'),
        { event_type: 'state', timestamp: '2026-07-19T15:59:00Z', event_data: 'not json' }
      ]
    }
    expect(onlineNames(data, NOW).size).toBe(0)
  })

  it('returns empty set for garbage payloads', () => {
    expect(onlineNames(null, NOW).size).toBe(0)
    expect(onlineNames({ nope: true }, NOW).size).toBe(0)
  })
})
