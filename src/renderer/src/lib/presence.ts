/**
 * Live-presence from station `state` server events.
 * `/v2/fleets/:id/server_events` items: { event_type, event_data (JSON string), timestamp (ISO) }.
 * A fresh `state` event's players[].name roster = who is online right now.
 */

/** State events older than this are stale — the station stopped reporting. */
export const PRESENCE_MAX_AGE_MS = 10 * 60 * 1000

/**
 * Presence from fresh `state` events. `known` is true when at least one fresh state
 * event parsed — an empty roster then genuinely means "nobody online", which must
 * not be confused with "no data" (stale events, request failed, wrong shape).
 */
export function presence(
  eventsData: unknown,
  now: number = Date.now()
): { known: boolean; online: Set<string> } {
  const d = eventsData as { items?: unknown[]; events?: unknown[] } | unknown[]
  const arr = Array.isArray(d) ? d : (d?.items ?? d?.events ?? [])
  const online = new Set<string>()
  let known = false
  for (const e of arr as Record<string, unknown>[]) {
    if (String(e.event_type ?? e.type ?? '') !== 'state') continue
    const t = typeof e.timestamp === 'string' ? Date.parse(e.timestamp) : Number(e.timestamp ?? 0)
    if (!Number.isFinite(t) || now - t > PRESENCE_MAX_AGE_MS) continue
    let data: unknown = e.event_data
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data)
      } catch {
        continue
      }
    }
    const players = (data as { players?: unknown[] })?.players
    if (!Array.isArray(players)) continue
    known = true
    for (const p of players as Record<string, unknown>[]) {
      const name = p?.name ?? p?.username
      if (typeof name === 'string' && name) online.add(name.toLowerCase())
    }
  }
  return { known, online }
}
