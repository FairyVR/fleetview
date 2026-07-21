import { api } from './api'

export interface FleetUser {
  id: string
  name: string
  /** Every identifying token for the user's roles (ids AND names) — the list API's role
   *  entries vary in shape, so we keep all candidates and match generously. */
  roles: string[]
}

/**
 * Pull every id/name token out of one role entry. The v3 user list returns role entries
 * as bare id/name strings on some fleets and as objects on others, and object keys are not
 * consistent (`role_id`/`role_name` vs `id`/`name`). Collect them all so membership matching
 * works regardless of shape — extracting only one key silently dropped everyone to `''`.
 */
export function roleTokens(r: unknown): string[] {
  if (r == null) return []
  if (typeof r === 'string' || typeof r === 'number') return [String(r)]
  const o = r as Record<string, unknown>
  return [o.role_id, o.id, o.role_name, o.name].filter((v) => v != null).map(String)
}

/** True when `user` carries `role` under any of its ids/names (case-insensitive). */
export function userHasRole(user: FleetUser, role: { id: string; name: string }): boolean {
  const want = new Set([role.id, role.name].filter(Boolean).map((s) => s.toLowerCase()))
  return user.roles.some((r) => want.has(r.toLowerCase()))
}

/** All users a fleet knows (v3, live-verified), with roles when the API includes them. */
export async function loadFleetUsers(fleetId: string): Promise<FleetUser[]> {
  const res = await api.request({
    endpointId: 'player.listByFleet',
    params: { fleetId, page_size: 100, include_roles: true }
  })
  const arr = (res.data as { items?: unknown[] } | null)?.items
  return (Array.isArray(arr) ? arr : [])
    .map((u) => u as Record<string, unknown>)
    .map((u) => ({
      id: String(u.user_id ?? ''),
      name: String(u.username ?? u.user_id ?? ''),
      roles: (Array.isArray(u.roles) ? u.roles : []).flatMap(roleTokens)
    }))
    .filter((u) => u.id)
}

/**
 * Turn a user ID or username into a user ID. Numeric input passes through untouched;
 * anything else is matched (case-insensitively) against the fleet's user list.
 */
export async function resolveUserId(
  fleetId: string,
  input: string
): Promise<{ userId: string } | { error: string }> {
  const t = input.trim()
  if (/^\d+$/.test(t)) return { userId: t }
  const users = await loadFleetUsers(fleetId)
  const hit = users.find((u) => u.name.toLowerCase() === t.toLowerCase())
  return hit ? { userId: hit.id } : { error: `No player named "${t}" in this fleet.` }
}
