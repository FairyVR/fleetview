/**
 * Orion Drift domain models.
 *
 * Field shapes are best-effort placeholders because the real dashboard API was not
 * available to inspect. They are intentionally permissive (optional fields, an index
 * signature via `raw`) so real responses render without a schema rewrite. Tighten these
 * once verified endpoints are added to the registry.
 */

export interface Fleet {
  id: string
  name: string
  description?: string
  region?: string
  stationCount?: number
  permissionLevel?: string
  raw?: Record<string, unknown>
}

export type StationStatus = 'online' | 'offline' | 'unknown'

export interface Station {
  id: string
  fleetId: string
  name: string
  region?: string
  status: StationStatus
  version?: string
  sessionId?: string
  playerCount?: number
  raw?: Record<string, unknown>
}

export interface Player {
  id: string
  displayName: string
  platformId?: string
  roles?: string[]
  banned?: boolean
  raw?: Record<string, unknown>
}

export interface Role {
  id: string
  name: string
  permissions?: string[]
  raw?: Record<string, unknown>
}

export interface BanRecord {
  id: string
  playerId: string
  reason?: string
  issuedBy?: string
  issuedAt?: number
  expiresAt?: number | null
  raw?: Record<string, unknown>
}

export interface MatchRecord {
  id: string
  stationId?: string
  gamemode?: string
  startedAt?: number
  endedAt?: number
  players?: { id: string; displayName: string; score?: number }[]
  serverStats?: Record<string, unknown>
  raw?: Record<string, unknown>
}

export interface ServerEvent {
  id: string
  timestamp: number
  type: string
  stationId?: string
  message?: string
  data?: Record<string, unknown>
  raw?: Record<string, unknown>
}

export interface Gamemode {
  key: string
  name: string
  arenaKey?: string
  /** Editable override params: name -> { current, default }. */
  overrides?: Record<string, { current: unknown; default: unknown }>
  raw?: Record<string, unknown>
}

/** One board texture slot the customization API exposes. */
export interface BoardSlot {
  key: string
  name: string
  textureUrl: string
}
