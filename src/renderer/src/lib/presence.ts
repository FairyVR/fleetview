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
