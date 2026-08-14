/**
 * Classifies what a key can actually *do* in a fleet, so the UI can lead with the fleets
 * worth opening instead of every fleet the key can merely see.
 *
 * Grants are advisory (`source: 'probed'` — see key-service). A fleet that classifies as
 * read-only or unknown must still be selectable: persisting an empty "discovered" set once
 * falsely blocked every action, and probes can never see write scopes at all.
 */

/** Scopes every key gets just for being able to see the fleet — not elevated access. */
const BASELINE = new Set(['fleet:read', 'role:read', 'station:read', 'server_event:read'])

/** Reading reports/bans/players or changing bans and roles = moderation work. */
const MODERATION = new Set([
  'user_data:read',
  'fleet_report:read',
  'user_ban:write',
  'user_ban:update',
  'user_ban:revoke',
  'user_roles:write',
  'role:write'
])

/** Reading or writing fleet/station config = configuration work. */
const CONFIGURATION = new Set([
  'fleet_config:read',
  'fleet_config:write',
  'station_config:read',
  'station_config:write',
  'fleet:write',
  'station:write'
])

export type AccessTier = 'admin' | 'elevated' | 'read' | 'unknown'

export interface FleetAccess {
  tier: AccessTier
  moderation: boolean
  configuration: boolean
  /** Scopes beyond the baseline, for badges. Empty for admin (which implies all of them). */
  extra: string[]
}

/**
 * `scopes` is the grants entry for one fleet: `undefined` when the fleet was never probed
 * (unknown, not denied), `[]`/baseline-only when probing found nothing elevated.
 */
export function fleetAccess(scopes: string[] | undefined): FleetAccess {
  if (!scopes) return { tier: 'unknown', moderation: false, configuration: false, extra: [] }
  if (scopes.includes('admin')) {
    return { tier: 'admin', moderation: true, configuration: true, extra: [] }
  }
  const extra = scopes.filter((s) => !BASELINE.has(s))
  const moderation = extra.some((s) => MODERATION.has(s))
  const configuration = extra.some((s) => CONFIGURATION.has(s))
  return {
    tier: moderation || configuration ? 'elevated' : 'read',
    moderation,
    configuration,
    extra
  }
}

/**
 * Can this key demonstrably *do* something in the fleet beyond reading it?
 *
 * Deliberately keeps `unknown` in: grants are probed, not declared, so an unprobed fleet
 * is very often manageable. Dropping it here would hide fleets the user administers —
 * the same mistake as denying an action on unknown permissions.
 */
export function isManageable(scopes: string[] | undefined): boolean {
  const tier = fleetAccess(scopes).tier
  return tier !== 'read'
}

/** Short human label for a tier — used on fleet cards and dropdown groups. */
export function accessLabel(a: FleetAccess): string {
  if (a.tier === 'admin') return 'admin — full access'
  if (a.tier === 'unknown') return 'access not probed'
  if (a.tier === 'read') return 'read-only'
  if (a.moderation && a.configuration) return 'moderation + config'
  return a.moderation ? 'moderation' : 'config'
}

/**
 * Manage-capable fleets first, then unprobed, then read-only; alphabetical within a group.
 * Unprobed outranks read-only on purpose: a fleet we never probed may well be manageable,
 * whereas one we did probe and found baseline-only demonstrably isn't.
 */
export function sortByAccess<T extends { id: string; name: string }>(
  fleets: T[],
  grants: Record<string, string[]>
): T[] {
  const rank: Record<AccessTier, number> = { admin: 0, elevated: 1, unknown: 2, read: 3 }
  return [...fleets].sort((a, b) => {
    const d = rank[fleetAccess(grants[a.id]).tier] - rank[fleetAccess(grants[b.id]).tier]
    return d !== 0 ? d : a.name.localeCompare(b.name)
  })
}
