/**
 * Pure logic behind the Overview fleet ops board: normalizing the `fleet.get`
 * payload, summarizing station health, and counting active bans / recent activity.
 * Kept out of the page so it stays testable (see tests/fleetOverview.test.ts).
 */

/** A station as the Overview needs it — richer than the v2 list (disabled/last_event). */
export interface OverviewStation {
  id: string
  name: string
  region?: string
  version?: string
  sessionId?: string
  ip?: string
  disabled: boolean
  online: boolean
  /** ms epoch of the last server event, or undefined when the field is absent. */
  lastEventAt?: number
  playerCount?: number
  raw: Record<string, unknown>
}

/** A station silent for longer than this is called out even if it claims to be online. */
export const STALE_STATION_MS = 10 * 60 * 1000

/**
 * The `online` flag from the stations list is unreliable (live-verified: it reports
 * false for stations whose last_event is seconds old). Treat a station as online unless
 * it's disabled or genuinely silent for a while.
 *
 * Shared by the Overview and Station Manager so the heuristic has one home.
 */
export function isOnline(s: Record<string, unknown>, now: number = Date.now()): boolean {
  if (s.disabled === true) return false
  if (s.online === true) return true
  const last = typeof s.last_event === 'string' ? Date.parse(s.last_event) : NaN
  if (!Number.isNaN(last)) return now - last < STALE_STATION_MS
  return true
}

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v ? v : undefined
}

/**
 * `fleet.get` (`GET /v1/fleets/:id`) is FLAT at the root — `{ fleet_id, fleet_name,
 * stations[], config }`, no wrapper. Tolerate the other shapes anyway; responses are untrusted.
 */
export function asOverviewStations(data: unknown, now: number = Date.now()): OverviewStation[] {
  const d = data as
    | { items?: unknown[]; stations?: unknown[]; fleet?: { stations?: unknown[] } }
    | unknown[]
    | null
  const arr = Array.isArray(d) ? d : (d?.stations ?? d?.items ?? d?.fleet?.stations ?? [])
  if (!Array.isArray(arr)) return []
  return (arr as Record<string, unknown>[]).map((s) => {
    const last = typeof s.last_event === 'string' ? Date.parse(s.last_event) : NaN
    return {
      id: String(s.station_id ?? s.id ?? ''),
      name: String(s.station_name ?? s.name ?? s.station_id ?? 'Unnamed station'),
      region: str(s.region),
      version: str(s.version),
      sessionId: str(s.session_id),
      ip: str(s.ip),
      disabled: s.disabled === true,
      online: isOnline(s, now),
      lastEventAt: Number.isNaN(last) ? undefined : last,
      playerCount: num(s.player_count),
      raw: s
    }
  })
}

export interface FleetAlert {
  stationId: string
  stationName: string
  detail: string
}

export interface FleetSummary {
  /** Every station the fleet owns, including the disabled pool. */
  total: number
  /** Stations that aren't disabled — the ones an operator actually watches. */
  active: number
  /** Online among the active ones. */
  online: number
  disabled: number
  /** Sum of live counts; undefined for stations with no reading, so this is a lower bound. */
  players: number
  alerts: FleetAlert[]
}

/**
 * Live counts come from the fleet event feed (`stationPlayerCounts` in lib/presence.ts) —
 * the station payload's own `player_count` is stale, so it's only a fallback.
 *
 * Real fleets keep a large pool of *disabled* stations (Strike: 936 of 939), so disabled is
 * a normal resting state, never an alert. Only an enabled station that has gone quiet is one.
 */
export function summarizeFleet(
  stations: OverviewStation[],
  liveCounts: Map<string, number> = new Map(),
  now: number = Date.now()
): FleetSummary {
  const alerts: FleetAlert[] = []
  let players = 0
  let online = 0
  let disabled = 0
  for (const s of stations) {
    if (s.disabled) {
      disabled++
      continue
    }
    const count = liveCounts.get(s.id) ?? s.playerCount
    if (typeof count === 'number') players += count
    if (s.online) online++
    // Only a station with a *known* stale heartbeat is an alert. With no last_event at all
    // there is nothing to judge, and isOnline deliberately gives it the benefit of the doubt.
    if (s.lastEventAt !== undefined && now - s.lastEventAt > STALE_STATION_MS) {
      const mins = Math.round((now - s.lastEventAt) / 60000)
      alerts.push({ stationId: s.id, stationName: s.name, detail: `no events for ${mins} min` })
    }
  }
  return { total: stations.length, active: stations.length - disabled, online, disabled, players, alerts }
}

export interface ActivityEntry {
  id: string
  type: string
  stationId?: string
  timestamp: number
}

/**
 * Recent fleet activity: every event type except `state`, which stations emit every ~15s
 * and would otherwise drown out everything worth reading.
 */
export function recentActivity(data: unknown, limit = 8): ActivityEntry[] {
  const items = (data as { items?: unknown[] } | null)?.items
  if (!Array.isArray(items)) return []
  const out: ActivityEntry[] = []
  for (const raw of items as Record<string, unknown>[]) {
    const type = String(raw?.event_type ?? raw?.type ?? '')
    if (!type || type === 'state') continue
    const t = typeof raw.timestamp === 'string' ? Date.parse(raw.timestamp) : Number(raw.timestamp)
    out.push({
      id: String(raw.idx ?? raw.id ?? `${type}-${t}`),
      type,
      stationId: str(raw.station_id),
      timestamp: Number.isNaN(t) ? 0 : t
    })
  }
  out.sort((a, b) => b.timestamp - a.timestamp)
  return out.slice(0, limit)
}

/**
 * Bans still in force: not revoked, and either permanent or not yet expired.
 * `expiration` comes back as UTC *without* a trailing Z on some routes — append one
 * when it's missing so it isn't parsed as local time.
 */
export function activeBanCount(data: unknown, now: number = Date.now()): number {
  const d = data as { bans?: unknown[]; items?: unknown[] } | unknown[] | null
  const arr = Array.isArray(d) ? d : (d?.bans ?? d?.items ?? [])
  if (!Array.isArray(arr)) return 0
  return (arr as Record<string, unknown>[]).filter((b) => {
    if (b?.revoked === true) return false
    const exp = b?.expiration
    if (typeof exp !== 'string' || !exp) return true // permanent
    const iso = /(Z|[+-]\d{2}:?\d{2})$/.test(exp) ? exp : `${exp}Z`
    const t = Date.parse(iso)
    return Number.isNaN(t) ? true : t > now
  }).length
}

/** Reports payload is a plain list; the API has no open/closed flag, so this is a total. */
export function reportCount(data: unknown): number {
  const d = data as { reports?: unknown[]; items?: unknown[] } | unknown[] | null
  const arr = Array.isArray(d) ? d : (d?.reports ?? d?.items ?? [])
  return Array.isArray(arr) ? arr.length : 0
}
