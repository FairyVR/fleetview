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
 * Confirm the key authenticates. There is no /me endpoint on this API, so the fleet list
 * (the lightest authenticated call) doubles as the identity/connectivity probe.
 */
export async function testKey(keyId: string): Promise<{ health: KeyHealth; message: string }> {
  const res = await executeRequest({ endpointId: 'fleet.list', keyId })

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
  const res = await executeRequest({ endpointId: 'fleet.list', keyId })
  const store = permissionsStore.get('perms')

  if (!res.ok) return store[keyId] ?? EMPTY_PERMISSIONS

  const grants = parseGrants(res.data)
  if (!grants) return store[keyId] ?? EMPTY_PERMISSIONS

  const perms: PermissionSet = { grants, raw: res.data, discoveredAt: Date.now() }
  store[keyId] = perms
  permissionsStore.set('perms', store)

  const fleets = Object.keys(grants)
  const allScopes = new Set(Object.values(grants).flat())
  patchKey(keyId, {
    permissionSummary: `${fleets.length} fleet${fleets.length === 1 ? '' : 's'} · ${
      allScopes.has('admin') ? 'admin · ' : ''
    }${allScopes.size} scopes`,
    fleetAccess: fleets
  })
  return perms
}

export function getPermissions(keyId: string): PermissionSet {
  return permissionsStore.get('perms')[keyId] ?? EMPTY_PERMISSIONS
}
