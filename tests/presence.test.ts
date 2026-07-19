import { describe, expect, it } from 'vitest'
import { presence, PRESENCE_MAX_AGE_MS } from '../src/renderer/src/lib/presence'

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

describe('presence', () => {
  it('collects lowercased names from fresh state events', () => {
    const data = { items: [stateEvent(['MoonwaIk', 'Fairy'], '2026-07-19T15:58:00Z')] }
    expect(presence(data, NOW)).toEqual({ known: true, online: new Set(['moonwaik', 'fairy']) })
  })

  it('fresh state event with empty roster = known, nobody online', () => {
    const data = { items: [stateEvent([], '2026-07-19T15:59:00Z')] }
    expect(presence(data, NOW)).toEqual({ known: true, online: new Set() })
  })

  it('stale state events = unknown', () => {
    const old = new Date(NOW - PRESENCE_MAX_AGE_MS - 1000).toISOString()
    const data = { items: [stateEvent(['Ghost'], old)] }
    expect(presence(data, NOW).known).toBe(false)
  })

  it('non-state events and unparseable event_data = unknown', () => {
    const data = {
      items: [
        stateEvent(['Runner'], '2026-07-19T15:59:00Z', 'gamemode_stopped'),
        { event_type: 'state', timestamp: '2026-07-19T15:59:00Z', event_data: 'not json' }
      ]
    }
    expect(presence(data, NOW).known).toBe(false)
  })

  it('garbage payloads = unknown', () => {
    expect(presence(null, NOW).known).toBe(false)
    expect(presence({ nope: true }, NOW).known).toBe(false)
  })
})
