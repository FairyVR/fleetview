import { api } from './api'

export interface FleetUser {
  id: string
  name: string
  roles: string[]
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
      roles: (Array.isArray(u.roles) ? u.roles : []).map((r) =>
        typeof r === 'string'
          ? r
          : String((r as Record<string, unknown>)?.role_id ?? (r as Record<string, unknown>)?.role_name ?? '')
      )
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
