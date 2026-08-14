import type { Station } from '@shared/models'

/**
 * `fleet.stations` returns only the stations currently *running*, so a station that is down
 * simply isn't in the response. `fleet.get` lists every station the fleet owns (including
 * `disabled`/`last_event`), so anything it knows about that the active list omits gets
 * merged in.
 *
 * Deliberately NOT sourced from the header's cached `fleet.list`: that call runs with
 * `include_offline_fleets: false`, so a fleet whose stations are all down is missing from it
 * entirely — precisely the case this feature exists to cover.
 *
 * Active entries always win; they carry the freshest player counts.
 */
export function mergeOfflineStations(active: Station[], known: Station[]): Station[] {
  const seen = new Set(active.map((s) => s.id))
  return [...active, ...known.filter((s) => !!s.id && !seen.has(s.id))]
}

/** Hide offline stations unless the user asked for them. */
export function visibleStations(stations: Station[], includeOffline: boolean): Station[] {
  return includeOffline ? stations : stations.filter((s) => s.status === 'online')
}
