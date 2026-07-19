/**
 * Live-presence from station `state` server events.
 * `/v2/fleets/:id/server_events` items: { event_type, event_data (JSON string), timestamp (ISO) }.
 * A fresh `state` event's players[].name roster = who is online right now.
 */

/** State events older than this are stale — the station stopped reporting. */
export const PRESENCE_MAX_AGE_MS = 10 * 60 * 1000

/** Lowercased names of players seen in fresh `state` events. Empty set = nobody / no usable data. */
export function onlineNames(eventsData: unknown, now: number = Date.now()): Set<string> {
  const d = eventsData as { items?: unknown[]; events?: unknown[] } | unknown[]
  const arr = Array.isArray(d) ? d : (d?.items ?? d?.events ?? [])
  const names = new Set<string>()
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
    for (const p of players as Record<string, unknown>[]) {
      const name = p?.name ?? p?.username
      if (typeof name === 'string' && name) names.add(name.toLowerCase())
    }
  }
  return names
}
