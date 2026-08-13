import { api } from './api'
import { loadFleetUsers } from './fleetUsers'

/**
 * User ID → display name, for IDs that only ever come back as raw IDs (a ban's `created_by`,
 * for example). Never throws and never blocks an action — an unresolved ID just stays an ID.
 */

/** fleetId → the fleet roster as an id→name map. One request per fleet, reused after that. */
const rosterCache = new Map<string, Promise<Map<string, string>>>()
/** userId → global profile name (or null). Memoized so N rows by one moderator = one request. */
const globalCache = new Map<string, Promise<string | null>>()

function loadRoster(fleetId: string): Promise<Map<string, string>> {
  let p = rosterCache.get(fleetId)
  if (!p) {
    p = loadFleetUsers(fleetId)
      .then((users) => new Map(users.map((u) => [u.id, u.name])))
      .catch(() => new Map<string, string>())
    rosterCache.set(fleetId, p)
  }
  return p
}

function loadGlobalName(userId: string): Promise<string | null> {
  let p = globalCache.get(userId)
  if (!p) {
    p = api
      .request({ endpointId: 'user.get', params: { userId } })
      .then((res) => {
        const name = (res.data as Record<string, unknown> | null)?.display_name
        return typeof name === 'string' && name ? name : null
      })
      // user.get needs the GLOBAL user_data:read scope; a fleet-only key 401s here. That's
      // expected, not an error — the caller falls back to showing the raw ID.
      .catch(() => null)
    globalCache.set(userId, p)
  }
  return p
}

/**
 * Resolve user IDs to names: the fleet roster first (one request, fleet-level scope), then
 * `user.get` for whoever is left. IDs that resolve to nothing are absent from the result.
 * ponytail: N+1 on the fallback — distinct moderators are few and each is cached for the session.
 */
export async function resolveUserNames(
  fleetId: string,
  ids: string[]
): Promise<Map<string, string>> {
  const wanted = [...new Set(ids.filter(Boolean))]
  if (wanted.length === 0) return new Map()

  const roster = await loadRoster(fleetId)
  const out = new Map<string, string>()
  const missing: string[] = []
  for (const id of wanted) {
    const name = roster.get(id)
    // The roster coercer falls back to the user_id when there's no username — that's not a name.
    if (name && name !== id) out.set(id, name)
    else missing.push(id)
  }

  await Promise.all(
    missing.map(async (id) => {
      const name = await loadGlobalName(id)
      if (name) out.set(id, name)
    })
  )
  return out
}
