import { describe, expect, it } from 'vitest'
import {
  activeBanCount,
  asOverviewStations,
  isOnline,
  recentActivity,
  reportCount,
  STALE_STATION_MS,
  summarizeFleet
} from '../src/renderer/src/lib/fleetOverview'

const NOW = Date.parse('2026-07-22T12:00:00Z')
const iso = (msAgo: number): string => new Date(NOW - msAgo).toISOString()

/** Shape taken from the fleet.get responseExample in the registry — flat, no wrapper. */
const fleetGet = {
  fleet_id: 'a93461f2',
  fleet_name: 'Strike Tournament',
  stations: [
    {
      station_id: 'stn-live',
      station_name: 'Strike_Tourney',
      region: 'us-east-2',
      ip: '82.97.206.98:22740',
      version: '65289',
      online: true,
      last_event: iso(30_000),
      player_count: 0,
      disabled: false
    },
    {
      station_id: 'stn-off',
      station_name: 'Strike_Backup',
      online: false,
      disabled: true,
      last_event: iso(60_000)
    },
    {
      station_id: 'stn-silent',
      station_name: 'Strike_Ghost',
      online: false,
      disabled: false,
      last_event: iso(STALE_STATION_MS + 60_000)
    }
  ],
  config: { is_public: true }
}

describe('isOnline', () => {
  it('disabled always wins over the online flag', () => {
    expect(isOnline({ disabled: true, online: true }, NOW)).toBe(false)
  })

  it('trusts an explicit online flag', () => {
    expect(isOnline({ online: true }, NOW)).toBe(true)
  })

  it('falls back to last_event freshness when online is false', () => {
    expect(isOnline({ online: false, last_event: iso(60_000) }, NOW)).toBe(true)
    expect(isOnline({ online: false, last_event: iso(STALE_STATION_MS + 1000) }, NOW)).toBe(false)
  })

  it('assumes online when there is nothing to go on', () => {
    expect(isOnline({}, NOW)).toBe(true)
  })
})

describe('asOverviewStations', () => {
  it('normalizes the flat fleet.get payload', () => {
    const stations = asOverviewStations(fleetGet, NOW)
    expect(stations).toHaveLength(3)
    expect(stations[0]).toMatchObject({
      id: 'stn-live',
      name: 'Strike_Tourney',
      region: 'us-east-2',
      version: '65289',
      ip: '82.97.206.98:22740',
      disabled: false,
      online: true,
      playerCount: 0
    })
    expect(stations[1].online).toBe(false)
    expect(stations[2].online).toBe(false)
  })

  it('tolerates wrapped and bare-array shapes', () => {
    expect(asOverviewStations({ items: fleetGet.stations }, NOW)).toHaveLength(3)
    expect(asOverviewStations({ fleet: { stations: fleetGet.stations } }, NOW)).toHaveLength(3)
    expect(asOverviewStations(fleetGet.stations, NOW)).toHaveLength(3)
  })

  it('returns nothing for junk', () => {
    expect(asOverviewStations(null, NOW)).toEqual([])
    expect(asOverviewStations({ stations: 'nope' }, NOW)).toEqual([])
  })
})

describe('summarizeFleet', () => {
  const stations = asOverviewStations(fleetGet, NOW)

  it('separates the disabled pool from the stations actually being watched', () => {
    const s = summarizeFleet(stations, new Map(), NOW)
    expect(s.total).toBe(3)
    expect(s.disabled).toBe(1)
    expect(s.active).toBe(2)
    expect(s.online).toBe(1)
  })

  it('prefers live counts over the stale payload one', () => {
    expect(summarizeFleet(stations, new Map([['stn-live', 7]]), NOW).players).toBe(7)
  })

  it('falls back to the payload player_count when there is no live reading', () => {
    expect(summarizeFleet(stations, new Map(), NOW).players).toBe(0)
  })

  it('never counts players on a disabled station', () => {
    expect(summarizeFleet(stations, new Map([['stn-off', 99]]), NOW).players).toBe(0)
  })

  it('alerts only on enabled stations that have gone quiet', () => {
    const { alerts } = summarizeFleet(stations, new Map(), NOW)
    expect(alerts.map((a) => a.stationId)).toEqual(['stn-silent'])
  })

  it('a large disabled pool produces no alerts at all', () => {
    // Strike really does run 936 disabled stations — that resting state must stay silent.
    const pool = asOverviewStations(
      {
        stations: Array.from({ length: 500 }, (_, i) => ({
          station_id: `p${i}`,
          disabled: true,
          last_event: iso(STALE_STATION_MS * 3)
        }))
      },
      NOW
    )
    const s = summarizeFleet(pool, new Map(), NOW)
    expect(s.alerts).toEqual([])
    expect(s.disabled).toBe(500)
    expect(s.active).toBe(0)
  })

  it('does not alert on a station with no last_event to judge', () => {
    const s = summarizeFleet(asOverviewStations({ stations: [{ station_id: 'x', online: false }] }, NOW), new Map(), NOW)
    expect(s.alerts).toEqual([])
    expect(s.online).toBe(1) // isOnline gives the benefit of the doubt
  })
})

describe('recentActivity', () => {
  const payload = {
    items: [
      { idx: 1, event_type: 'state', timestamp: iso(1000), station_id: 'a' },
      { idx: 2, event_type: 'gamemode_started', timestamp: iso(5000), station_id: 'a' },
      { idx: 3, event_type: 'gamemode_stopped', timestamp: iso(2000), station_id: 'b' }
    ]
  }

  it('drops state events and sorts newest first', () => {
    const out = recentActivity(payload)
    expect(out.map((e) => e.type)).toEqual(['gamemode_stopped', 'gamemode_started'])
  })

  it('respects the limit', () => {
    expect(recentActivity(payload, 1)).toHaveLength(1)
  })

  it('returns nothing for junk', () => {
    expect(recentActivity(null)).toEqual([])
    expect(recentActivity({ items: 'nope' })).toEqual([])
  })
})

describe('activeBanCount', () => {
  it('counts permanent and unexpired bans, skipping revoked and expired', () => {
    const bans = {
      bans: [
        { ban_id: '1', expiration: null, revoked: false },
        { ban_id: '2', expiration: new Date(NOW + 3_600_000).toISOString(), revoked: false },
        { ban_id: '3', expiration: new Date(NOW - 3_600_000).toISOString(), revoked: false },
        { ban_id: '4', expiration: null, revoked: true }
      ]
    }
    expect(activeBanCount(bans, NOW)).toBe(2)
  })

  it('treats a Z-less expiration as UTC, not local time', () => {
    // 30 min in the future in UTC. Parsed as local time this flips sign in most zones.
    const exp = new Date(NOW + 1_800_000).toISOString().replace('Z', '')
    expect(activeBanCount({ bans: [{ expiration: exp, revoked: false }] }, NOW)).toBe(1)
  })

  it('keeps a ban whose expiration is unparseable rather than silently dropping it', () => {
    expect(activeBanCount({ bans: [{ expiration: 'soon', revoked: false }] }, NOW)).toBe(1)
  })

  it('returns 0 for junk', () => {
    expect(activeBanCount(null, NOW)).toBe(0)
    expect(activeBanCount({ bans: 'nope' }, NOW)).toBe(0)
  })
})

describe('reportCount', () => {
  it('counts list, items, and bare-array shapes', () => {
    expect(reportCount({ reports: [{}, {}] })).toBe(2)
    expect(reportCount({ items: [{}] })).toBe(1)
    expect(reportCount([{}, {}, {}])).toBe(3)
    expect(reportCount(null)).toBe(0)
  })
})
