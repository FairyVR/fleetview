/** Authentication + permission models. The raw API key secret NEVER appears here. */

export type KeyHealth = 'unknown' | 'valid' | 'invalid' | 'expired' | 'error'

/**
 * Public metadata about a stored API key. The secret itself lives encrypted in the
 * OS credential store and is only ever read inside the main process.
 */
export interface ApiKeyRecord {
  id: string
  name: string
  owner?: string
  createdAt: number
  lastUsedAt?: number
  lastValidatedAt?: number
  health: KeyHealth
  /** Human-readable summary derived from the discovered grants. */
  permissionSummary?: string
  fleetAccess?: string[]
  stationAccess?: string[]
  /** Masked hint so the user can tell keys apart, e.g. "od_live_…9f2a". */
  maskedHint?: string
}

/**
 * Permissions in Orion Drift are granted PER FLEET, not per account. Each fleet maps to a
 * list of scope strings like "fleet:read", "station_config:write", "user_ban:write".
 * The special scope "admin" grants every permission within that fleet.
 */
export interface PermissionSet {
  /** fleetId/name -> scopes granted for that fleet. */
  grants: Record<string, string[]>
  /** Raw permission payload from the API, retained for the Developer view. */
  raw?: unknown
  /** 0 = never successfully discovered (unknown — the UI must NOT deny actions). */
  discoveredAt: number
  /**
   * 'explicit' = the API returned actual scope lists (may pre-flight deny).
   * 'probed' = inferred from read-only probes — advisory only, must NEVER deny:
   * probes can't see write scopes, so absence in a probed set proves nothing.
   */
  source?: 'explicit' | 'probed'
}

export const EMPTY_PERMISSIONS: PermissionSet = {
  grants: {},
  discoveredAt: 0
}

/** Outcome of one endpoint probe in the per-fleet verification battery. */
export interface FleetProbeResult {
  scope: string
  endpointId: string
  ok: boolean
  status: number
  message?: string
}

/**
 * Merge newly confirmed scopes for one fleet into an existing set. Only ever widens
 * grants (probes confirm, never revoke); an 'explicit' source is preserved, anything
 * else becomes 'probed'.
 */
export function mergeProbedScopes(
  prev: PermissionSet | undefined,
  fleetId: string,
  scopes: string[]
): PermissionSet {
  const grants = { ...(prev?.grants ?? {}) }
  grants[fleetId] = [...new Set([...(grants[fleetId] ?? []), ...scopes])]
  return {
    ...(prev ?? EMPTY_PERMISSIONS),
    grants,
    discoveredAt: Date.now(),
    source: prev?.source === 'explicit' ? 'explicit' : 'probed'
  }
}

/** True when this fleet's scope list satisfies `scope` ("admin" grants everything). */
export function fleetHasScope(scopes: string[], scope: string): boolean {
  return scopes.includes('admin') || scopes.includes(scope)
}

/**
 * True if the key holds `scope` in the given fleet — or, when `fleetId` is omitted or the
 * fleet is unknown to us (e.g. station-scoped calls), in ANY fleet. Permissive by design:
 * the server is the authority; this only gates obviously-unavailable actions.
 */
export function hasScope(perms: PermissionSet, scope: string, fleetId?: string): boolean {
  const grants = perms.grants ?? {}
  if (fleetId && grants[fleetId]) return fleetHasScope(grants[fleetId], scope)
  return Object.values(grants).some((scopes) => fleetHasScope(scopes, scope))
}

/** True when the set has usable, successfully-discovered grant data. */
export function isDiscovered(perms: PermissionSet | undefined | null): perms is PermissionSet {
  return !!perms && perms.discoveredAt > 0 && !!perms.grants && Object.keys(perms.grants).length > 0
}

/**
 * Extract per-fleet scope grants from an unknown-shape permissions payload.
 * Tolerates several plausible encodings; returns null when nothing parseable is found —
 * callers must treat null as "unknown", never as "no permissions".
 */
export function parseGrants(data: unknown): Record<string, string[]> | null {
  if (!data || typeof data !== 'object') return null
  const d = data as Record<string, unknown>

  // Flat scope list with no fleet breakdown — keep under a wildcard fleet key.
  // Checked first so { scopes: [...] } isn't misread as a fleet named "scopes".
  const flat = [d.scopes, d.permissions].find(
    (v): v is string[] => Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === 'string')
  )
  if (flat) return { '*': flat }

  const candidates: unknown[] = [d.permissions, d.fleets, d.grants, d.items, data]

  for (const c of candidates) {
    // Array form: [{ fleet|fleetId|id|name, permissions|scopes: string[] }, …]
    if (Array.isArray(c)) {
      const out: Record<string, string[]> = {}
      for (const item of c) {
        if (!item || typeof item !== 'object') continue
        const o = item as Record<string, unknown>
        const key = [o.fleet_name, o.fleet_id, o.fleetId, o.fleet, o.id, o.name].find(
          (v) => typeof v === 'string'
        ) as string | undefined
        const scopes = [o.permissions, o.scopes].find(Array.isArray) as unknown[] | undefined
        if (key && scopes) out[key] = scopes.map(String)
      }
      if (Object.keys(out).length) return out
    }
    // Map form: { [fleet]: string[] }
    if (c && typeof c === 'object' && !Array.isArray(c)) {
      const entries = Object.entries(c as Record<string, unknown>)
      if (
        entries.length &&
        entries.every(([, v]) => Array.isArray(v) && v.every((x) => typeof x === 'string'))
      ) {
        return Object.fromEntries(entries.map(([k, v]) => [k, v as string[]]))
      }
    }
  }

  return null
}
