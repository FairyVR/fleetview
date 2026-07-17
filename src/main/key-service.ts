import { randomUUID } from 'node:crypto'
import type { ApiKeyRecord, KeyHealth, PermissionSet } from '@shared/models'
import { EMPTY_PERMISSIONS } from '@shared/models'
import { keysStore, secretsStore, permissionsStore, settingsStore } from './stores'
import { saveSecret, deleteSecret } from './secure-storage'
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

/** Ping the identity endpoint to confirm the key authenticates. */
export async function testKey(keyId: string): Promise<{ health: KeyHealth; message: string }> {
  const res = await executeRequest({ endpointId: 'auth.whoami', keyId })
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
 * Discover the permission set for a key by calling the permissions endpoint and mapping
 * the (unknown-shape) response onto our PermissionSet. Permissive by design.
 */
export async function discoverPermissions(keyId: string): Promise<PermissionSet> {
  const res = await executeRequest({ endpointId: 'permissions.summary', keyId })
  const perms: PermissionSet = { ...EMPTY_PERMISSIONS, discoveredAt: Date.now() }

  if (res.ok && res.data && typeof res.data === 'object') {
    const d = res.data as Record<string, unknown>
    const scopes = Array.isArray(d.scopes) ? (d.scopes as string[]) : []
    perms.read = scopes.includes('read') || res.ok
    perms.write = scopes.includes('write')
    perms.moderation = scopes.includes('moderation')
    perms.playerManagement = scopes.includes('player-management') || scopes.includes('players')
    perms.roleManagement = scopes.includes('role-management') || scopes.includes('roles')
    perms.customization = scopes.includes('customization')
    perms.events = scopes.includes('events')
    perms.fleets = Array.isArray(d.fleets) ? (d.fleets as string[]) : []
    perms.stations = Array.isArray(d.stations) ? (d.stations as string[]) : []
    perms.raw = res.data
  }

  const store = permissionsStore.get('perms')
  store[keyId] = perms
  permissionsStore.set('perms', store)

  const active: string[] = []
  for (const [flag, label] of [
    ['read', 'read'],
    ['write', 'write'],
    ['moderation', 'moderation'],
    ['playerManagement', 'players'],
    ['roleManagement', 'roles'],
    ['customization', 'customization'],
    ['events', 'events']
  ] as const) {
    if (perms[flag]) active.push(label)
  }
  patchKey(keyId, {
    permissionSummary: active.join(', ') || 'none',
    fleetAccess: perms.fleets,
    stationAccess: perms.stations
  })
  return perms
}

export function getPermissions(keyId: string): PermissionSet {
  return permissionsStore.get('perms')[keyId] ?? EMPTY_PERMISSIONS
}
