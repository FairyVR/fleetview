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
  /** Human-readable summary derived from the permission set, e.g. "read, moderation". */
  permissionSummary?: string
  fleetAccess?: string[]
  stationAccess?: string[]
  /** Masked hint so the user can tell keys apart, e.g. "od_live_…9f2a". */
  maskedHint?: string
}

/** Per-scope permission booleans, discovered after authentication. */
export interface PermissionSet {
  read: boolean
  write: boolean
  moderation: boolean
  playerManagement: boolean
  roleManagement: boolean
  customization: boolean
  events: boolean
  /** Fleets this key can touch, by id. Empty = unknown/none. */
  fleets: string[]
  /** Stations this key can touch, by id. */
  stations: string[]
  /** Raw permission payload from the API, retained for the Developer view. */
  raw?: unknown
  discoveredAt: number
}

export const EMPTY_PERMISSIONS: PermissionSet = {
  read: false,
  write: false,
  moderation: false,
  playerManagement: false,
  roleManagement: false,
  customization: false,
  events: false,
  fleets: [],
  stations: [],
  discoveredAt: 0
}

/** Map a permission scope name (from the registry) to a PermissionSet flag. */
export function scopeToFlag(scope: string): keyof PermissionSet | null {
  switch (scope) {
    case 'read':
      return 'read'
    case 'write':
      return 'write'
    case 'moderation':
      return 'moderation'
    case 'player-management':
      return 'playerManagement'
    case 'role-management':
      return 'roleManagement'
    case 'customization':
      return 'customization'
    case 'events':
      return 'events'
    default:
      return null
  }
}
