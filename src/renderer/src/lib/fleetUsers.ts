import { api } from './api'

export interface FleetUser {
  id: string
  name: string
}

export interface FleetRole {
  id: string
  name: string
  permissions: string[]
}

/**
 * Coerce a users payload into FleetUsers. The list endpoint wraps in `items`, the
 * role-members endpoint (`/v2/.../roles/:id/users`) wraps in `users` — accept both, plus a
 * bare array.
 */
function coerceFleetUsers(data: unknown): FleetUser[] {
  const d = data as { items?: unknown[]; users?: unknown[] } | null
  const arr = Array.isArray(data) ? data : d?.items ?? d?.users
  return (Array.isArray(arr) ? arr : [])
    .map((u) => u as Record<string, unknown>)
    .map((u) => ({
      id: String(u.user_id ?? u.id ?? ''),
      name: String(u.username ?? u.display_name ?? u.user_id ?? '')
    }))
    .filter((u) => u.id)
}

/** All users a fleet knows (v3, live-verified). */
export async function loadFleetUsers(fleetId: string): Promise<FleetUser[]> {
  const res = await api.request({
    endpointId: 'player.listByFleet',
    params: { fleetId, page_size: 100 }
  })
  return coerceFleetUsers(res.data)
}

/** The fleet's roles (`{ roles: [...] }`), id + name only. */
export async function loadFleetRoles(fleetId: string): Promise<FleetRole[]> {
  const res = await api.request({ endpointId: 'roles.list', params: { fleetId } })
  const arr = (res.data as { roles?: unknown[] } | null)?.roles ?? res.data
  return (Array.isArray(arr) ? arr : [])
    .map((r) => r as Record<string, unknown>)
    .map((r) => ({
      id: String(r.role_id ?? r.id ?? ''),
      name: String(r.role_name ?? r.name ?? 'Unknown'),
      permissions: Array.isArray(r.permissions) ? (r.permissions as unknown[]).map(String) : []
    }))
    .filter((r) => r.id)
}

/** Users who currently hold a specific role (v2, live-confirmed 2026-07-20). */
export async function loadRoleMembers(fleetId: string, roleId: string): Promise<FleetUser[]> {
  const res = await api.request({ endpointId: 'roles.members', params: { fleetId, roleId } })
  return coerceFleetUsers(res.data)
}

/**
 * Roles a single user holds, by cross-referencing every role's member list — the only
 * reliable source, since the user endpoints return roles:null.
 * ponytail: N+1 (one members call per role); replace with a per-user roles endpoint if one appears.
 */
export async function loadUserRoles(fleetId: string, userId: string): Promise<FleetRole[]> {
  const roles = await loadFleetRoles(fleetId)
  const held = await Promise.all(
    roles.map(async (role) => {
      const members = await loadRoleMembers(fleetId, role.id)
      return members.some((m) => m.id === userId) ? role : null
    })
  )
  return held.filter((r): r is FleetRole => r !== null)
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
