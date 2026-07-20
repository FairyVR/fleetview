/**
 * Live-presence heuristic (proven in the Strike pop Discord bot):
 * `/v3/fleets/:id/users` continuously bumps `last_login` for players actively
 * in-game, so a last_login within the last 3 minutes reliably matches the
 * station player count. No extra request needed — the players list has it.
 */

/** In-game players get last_login refreshed continuously; 3 min matches server pop. */
export const ONLINE_WINDOW_MS = 3 * 60 * 1000

export function isOnline(lastLogin: number | undefined, now: number = Date.now()): boolean {
  return lastLogin !== undefined && now - lastLogin <= ONLINE_WINDOW_MS
}

/**
 * Per-station live player counts from fleet `state` server events
 * (GET /v2/fleets/:id/server_events — the only reliable per-station roster;
 * the stations list's player_count/online fields are stale or absent).
 * Stations emit a state event every ~15s while running; a fresh event with an
 * empty players[] genuinely means zero, a stale/missing one means unknown.
 */
export const STATE_FRESH_MS = 2 * 60 * 1000

export function stationPlayerCounts(eventsPayload: unknown, now: number = Date.now()): Map<string, number> {
  const counts = new Map<string, number>()
  const items = (eventsPayload as { items?: unknown[] } | null)?.items
  if (!Array.isArray(items)) return counts
  // API returns newest-first — first fresh state event per station wins.
  for (const raw of items as Record<string, unknown>[]) {
    if (raw?.event_type !== 'state') continue
    const id = typeof raw.station_id === 'string' ? raw.station_id : undefined
    if (!id || counts.has(id)) continue
    const ts = typeof raw.timestamp === 'string' ? Date.parse(raw.timestamp) : NaN
    if (Number.isNaN(ts) || now - ts > STATE_FRESH_MS) continue
    try {
      const data = JSON.parse(raw.event_data as string) as { players?: unknown[] }
      if (Array.isArray(data.players)) counts.set(id, data.players.length)
    } catch {
      // unparseable event_data — skip
    }
  }
  return counts
}
