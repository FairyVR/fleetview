import { randomUUID } from 'node:crypto'
import type { ApiKeyRecord, KeyHealth, PermissionSet, FleetProbeResult } from '@shared/models'
import { EMPTY_PERMISSIONS, parseGrants, mergeProbedScopes } from '@shared/models'
import { keysStore, permissionsStore, settingsStore } from './stores'
import { saveSecret, deleteSecret, readSecret, looksLikeJwt } from './secure-storage'
import { executeRequest } from './api-client'

export function listKeys(): ApiKeyRecord[] {
  return keysStore.get('keys')
}

export function getActiveKeyId(): string | null {
  return settingsStore.get('activeKeyId')
}

export function setActiveKey(keyId: string | null): void {
  settingsStore.set('activeKeyId', keyId)
}

/** Add a new key. The secret is encrypted immediately and never returned. */
export function addKey(input: { name: string; owner?: string; secret: string }): ApiKeyRecord {
  const id = randomUUID()
  const maskedHint = saveSecret(id, input.secret.trim())
  const record: ApiKeyRecord = {
    id,
    name: input.name.trim() || 'Unnamed key',
    owner: input.owner?.trim() || undefined,
    createdAt: Date.now(),
    health: 'unknown',
    maskedHint
  }
  const keys = keysStore.get('keys')
  keys.push(record)
  keysStore.set('keys', keys)
  // First key added becomes active automatically.
  if (!settingsStore.get('activeKeyId')) settingsStore.set('activeKeyId', id)
  return record
}

export function renameKey(keyId: string, name: string, owner?: string): void {
  const keys = keysStore.get('keys')
  const k = keys.find((x) => x.id === keyId)
  if (k) {
    k.name = name.trim() || k.name
    k.owner = owner?.trim() || k.owner
    keysStore.set('keys', keys)
  }
}

export function removeKey(keyId: string): void {
  keysStore.set('keys', keysStore.get('keys').filter((k) => k.id !== keyId))
  deleteSecret(keyId)
  const perms = permissionsStore.get('perms')
  delete perms[keyId]
  permissionsStore.set('perms', perms)
  if (settingsStore.get('activeKeyId') === keyId) {
    const remaining = keysStore.get('keys')
    settingsStore.set('activeKeyId', remaining[0]?.id ?? null)
  }
}

function patchKey(keyId: string, patch: Partial<ApiKeyRecord>): void {
  const keys = keysStore.get('keys')
  const k = keys.find((x) => x.id === keyId)
  if (k) {
    Object.assign(k, patch)
    keysStore.set('keys', keys)
  }
}

/**
 * The exact fleet-list request the official dashboard makes: one call returns every
 * accessible fleet with its stations and config embedded.
 * ponytail: single page of 32; paginate when a key sees more fleets.
 */
const FLEET_LIST_PARAMS = {
  include_config: true,
  include_stations: true,
  include_offline_fleets: false,
  page_size: 32,
  page: 1
}

/** Pull the fleet array out of the paged response, whatever the exact wrapper key. */
function extractFleets(data: unknown): Record<string, unknown>[] {
  const d = data as Record<string, unknown> | null
  const arr = [d?.items, d?.fleets, data].find(Array.isArray) as unknown[] | undefined
  return (arr ?? []).filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
}

const fleetIdOf = (f: Record<string, unknown>): string | undefined =>
  [f.fleet_id, f.fleetId, f.id].find((v) => typeof v === 'string') as string | undefined

/** Keys are JWTs; the payload names the owning user when the key is user-issued. */
export function jwtUserId(secret: string): string | null {
  try {
    const payload = JSON.parse(Buffer.from(secret.split('.')[1], 'base64url').toString())
    const id = payload.user_id ?? payload.sub ?? payload.uid
    return id != null ? String(id) : null
  } catch {
    return null
  }
}

/**
 * Read the key owner's roles in a fleet and aggregate their permission strings — the
 * authoritative grant list, no probing needed. Returns null when roles aren't readable
 * or the user holds none, so the caller falls back to endpoint probes.
 * ponytail: N+1 members calls (one per role); replace with a per-user roles endpoint if one appears.
 */
async function roleScopes(keyId: string, fleetId: string, userId: string): Promise<string[] | null> {
  const rolesRes = await executeRequest({ endpointId: 'roles.list', keyId, params: { fleetId } })
  if (!rolesRes.ok) return null
  const rolesArr = (rolesRes.data as { roles?: unknown[] } | null)?.roles ?? rolesRes.data
  if (!Array.isArray(rolesArr)) return null

  const scopes = new Set(['fleet:read', 'role:read'])
  let heldAny = false
  await Promise.all(
    (rolesArr as Record<string, unknown>[]).map(async (role) => {
      const roleId = String(role.role_id ?? role.id ?? '')
      if (!roleId) return
      const m = await executeRequest({ endpointId: 'roles.members', keyId, params: { fleetId, roleId } })
      const d = m.data as { users?: unknown[]; items?: unknown[] } | null
      const members = (Array.isArray(m.data) ? m.data : d?.users ?? d?.items ?? []) as Record<string, unknown>[]
      if (m.ok && members.some((u) => String(u?.user_id ?? u?.id ?? '') === userId)) {
        heldAny = true
        if (Array.isArray(role.permissions)) role.permissions.forEach((p) => scopes.add(String(p)))
      }
    })
  )
  return heldAny ? [...scopes] : null
}

/**
 * Confirm the key authenticates. There is no /me endpoint on this API, so the fleet list
 * (the lightest authenticated call) doubles as the identity/connectivity probe.
 */
export async function testKey(keyId: string): Promise<{ health: KeyHealth; message: string }> {
  const res = await executeRequest({ endpointId: 'fleet.list', keyId, params: FLEET_LIST_PARAMS })

  // The API rejects non-JWT keys with a confusing decode error — name it plainly.
  if (res.status === 401 && !looksLikeJwt(readSecret(keyId) ?? '')) {
    patchKey(keyId, { health: 'invalid', lastValidatedAt: Date.now() })
    return {
      health: 'invalid',
      message:
        "This key isn't a valid Orion Drift API key. Keys are JWTs with three dot-separated parts (xxx.yyy.zzz) — copy the whole key from dashboard.oriondrift.net/account."
    }
  }
  let health: KeyHealth
  let message: string
  if (res.ok) {
    const n = extractFleets(res.data).length
    health = 'valid'
    message = `Key authenticated · sees ${n} fleet${n === 1 ? '' : 's'}.`
  } else if (res.error?.kind === 'auth-expired') {
    health = 'invalid'
    message = res.error.message
  } else if (res.error?.kind === 'network' || res.error?.kind === 'timeout') {
    health = 'error'
    message = `Could not reach the server (${res.error.kind}). Check the base URL in Settings.`
  } else {
    health = 'error'
    message = res.error?.message ?? 'Unexpected response.'
  }
  patchKey(keyId, { health, lastValidatedAt: Date.now() })
  return { health, message }
}

/**
 * Discover the per-fleet permission grants for a key. A failed or unparseable discovery
 * NEVER persists an empty "discovered" set — that would wrongly deny every action.
 * Instead the stored state stays unknown and the API client attempts requests normally.
 */
export async function discoverPermissions(keyId: string): Promise<PermissionSet> {
  // The API exposes no "my permissions" endpoint; the fleet list is what reveals which
  // fleets the key can reach (and, when present, the caller's scopes on each).
  const res = await executeRequest({ endpointId: 'fleet.list', keyId, params: FLEET_LIST_PARAMS })
  const store = permissionsStore.get('perms')

  if (!res.ok) return store[keyId] ?? EMPTY_PERMISSIONS

  const fleets = extractFleets(res.data)
  const fleetIds = fleets.map(fleetIdOf).filter((id): id is string => !!id)
  const stationIds = fleets
    .flatMap((f) => (Array.isArray(f.stations) ? f.stations : []))
    .map((s) => (s as Record<string, unknown>)?.station_id)
    .filter((id): id is string => typeof id === 'string')

  const explicit = parseGrants(res.data)
  let perms: PermissionSet
  if (explicit) {
    perms = { grants: explicit, raw: res.data, discoveredAt: Date.now(), source: 'explicit' }
  } else if (fleetIds.length) {
    // Service keys get no scope lists back. Best source: the key owner's roles, whose
    // permission arrays ARE the grant list. When roles aren't readable (or the JWT names
    // no user), fall back to probing read endpoints — 200 confirms the scope; anything
    // else stays silent. Either way grants are advisory (source 'probed') and NEVER
    // pre-flight deny: writes are unprobeable.
    const grants: Record<string, string[]> = Object.fromEntries(
      fleetIds.map((id) => [id, ['fleet:read']])
    )
    const userId = jwtUserId(readSecret(keyId) ?? '')
    const probes: Array<{ endpointId: string; scope: string }> = [
      { endpointId: 'fleet.stations', scope: 'station:read' },
      { endpointId: 'moderation.bans', scope: 'user_data:read' }
    ]
    await Promise.allSettled(
      fleetIds.map(async (fleetId) => {
        const fromRoles = userId ? await roleScopes(keyId, fleetId, userId).catch(() => null) : null
        if (fromRoles) {
          grants[fleetId] = fromRoles
          return
        }
        await Promise.allSettled(
          probes.map(async ({ endpointId, scope }) => {
            const r = await executeRequest({ endpointId, keyId, params: { fleetId } })
            if (r.ok) grants[fleetId].push(scope)
          })
        )
      })
    )
    // Keep scopes confirmed by earlier deep verification (verifyFleetAccess) — this cheap
    // 2-probe pass must widen knowledge, never erase it. Fleets gone from the list drop out.
    const prev = store[keyId]
    if (prev && prev.source !== 'explicit') {
      for (const [fid, scopes] of Object.entries(prev.grants ?? {})) {
        if (grants[fid]) grants[fid] = [...new Set([...grants[fid], ...scopes])]
      }
    }
    perms = { grants, raw: res.data, discoveredAt: Date.now(), source: 'probed' }
  } else {
    // Nothing parseable — stay unknown; never persist an empty "discovered" set.
    return store[keyId] ?? EMPTY_PERMISSIONS
  }

  store[keyId] = perms
  permissionsStore.set('perms', store)
  summarizeKey(keyId, perms, stationIds)
  return perms
}

/** Refresh the key card's human-readable summary from its grant set. */
function summarizeKey(keyId: string, perms: PermissionSet, stationIds: string[]): void {
  const grantedFleets = Object.keys(perms.grants)
  const allScopes = new Set(Object.values(perms.grants).flat())
  patchKey(keyId, {
    permissionSummary: `${grantedFleets.length} fleet${grantedFleets.length === 1 ? '' : 's'} · ${
      stationIds.length
    } station${stationIds.length === 1 ? '' : 's'} · ${
      allScopes.has('admin') ? 'admin' : `${allScopes.size} scope${allScopes.size === 1 ? '' : 's'}${perms.source === 'probed' ? ' (probed)' : ''}`
    }`,
    fleetAccess: grantedFleets,
    stationAccess: stationIds
  })
}

/** Every verified fleet-scoped read endpoint, probeable without side effects. */
const FLEET_PROBES: Array<{ endpointId: string; scope: string }> = [
  { endpointId: 'fleet.stations', scope: 'station:read' },
  { endpointId: 'moderation.bans', scope: 'user_data:read' },
  { endpointId: 'fleet.config.get', scope: 'fleet_config:read' },
  { endpointId: 'reports.list', scope: 'fleet_report:read' },
  { endpointId: 'events.fleet', scope: 'server_event:read' }
]

/**
 * Deep-verify one fleet: probe every verified read endpoint, optionally confirm write
 * access by re-POSTing the fleet's current config unchanged (a payload no-op — the only
 * safe write probe). Confirmed scopes are merged into the key's stored grants so gates
 * and badges light up; failures are reported but never revoke anything.
 */
export async function verifyFleetAccess(
  keyId: string,
  fleetId: string,
  testWrite = false
): Promise<FleetProbeResult[]> {
  let configData: unknown = null
  const results: FleetProbeResult[] = await Promise.all(
    FLEET_PROBES.map(async ({ endpointId, scope }) => {
      const r = await executeRequest({ endpointId, keyId, params: { fleetId } })
      if (endpointId === 'fleet.config.get' && r.ok) configData = r.data
      return { scope, endpointId, ok: r.ok, status: r.status, message: r.error?.message }
    })
  )

  if (testWrite) {
    if (configData && typeof configData === 'object') {
      // Single-key no-op re-save. The API wants a FLAT partial map with STRING values —
      // wrapped/typed/full-blob bodies 422 (shape verified from the working bot client).
      const cfg = configData as Record<string, unknown>
      const key =
        'is_whitelist' in cfg
          ? 'is_whitelist'
          : Object.keys(cfg).find((k) => ['string', 'number', 'boolean'].includes(typeof cfg[k]))
      const w = await executeRequest({
        endpointId: 'fleet.config.set',
        keyId,
        params: { fleetId },
        body: key ? { [key]: String(cfg[key]) } : {}
      })
      results.push({
        scope: 'fleet_config:write',
        endpointId: 'fleet.config.set',
        ok: w.ok,
        status: w.status,
        message: w.error?.message
      })
    } else {
      results.push({
        scope: 'fleet_config:write',
        endpointId: 'fleet.config.set',
        ok: false,
        status: 0,
        message: 'Skipped — could not read the current config to re-save.'
      })
    }
  }

  const confirmed = ['fleet:read', ...results.filter((r) => r.ok).map((r) => r.scope)]
  const store = permissionsStore.get('perms')
  const merged = mergeProbedScopes(store[keyId], fleetId, confirmed)
  store[keyId] = merged
  permissionsStore.set('perms', store)
  const key = keysStore.get('keys').find((k) => k.id === keyId)
  summarizeKey(keyId, merged, key?.stationAccess ?? [])
  return results
}

export function getPermissions(keyId: string): PermissionSet {
  return permissionsStore.get('perms')[keyId] ?? EMPTY_PERMISSIONS
}
