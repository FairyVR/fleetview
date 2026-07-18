import { randomUUID } from 'node:crypto'
import type { ApiKeyRecord, KeyHealth, PermissionSet } from '@shared/models'
import { EMPTY_PERMISSIONS, parseGrants } from '@shared/models'
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
    health = 'valid'
    message = 'Key authenticated successfully.'
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
    // Service keys get no scope lists back — probe read endpoints per fleet instead.
    // 200 confirms the scope; anything else stays silent. Probed grants are advisory
    // (source 'probed') and NEVER pre-flight deny: writes are unprobeable.
    const grants: Record<string, string[]> = Object.fromEntries(
      fleetIds.map((id) => [id, ['fleet:read']])
    )
    const probes: Array<{ endpointId: string; scope: string }> = [
      { endpointId: 'fleet.stations', scope: 'station:read' },
      { endpointId: 'moderation.bans', scope: 'user_data:read' }
    ]
    await Promise.allSettled(
      fleetIds.flatMap((fleetId) =>
        probes.map(async ({ endpointId, scope }) => {
          const r = await executeRequest({ endpointId, keyId, params: { fleetId } })
          if (r.ok) grants[fleetId].push(scope)
        })
      )
    )
    perms = { grants, raw: res.data, discoveredAt: Date.now(), source: 'probed' }
  } else {
    // Nothing parseable — stay unknown; never persist an empty "discovered" set.
    return store[keyId] ?? EMPTY_PERMISSIONS
  }

  store[keyId] = perms
  permissionsStore.set('perms', store)

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
  return perms
}

export function getPermissions(keyId: string): PermissionSet {
  return permissionsStore.get('perms')[keyId] ?? EMPTY_PERMISSIONS
}
