import type { HttpMethod } from '../models/api'

/** Which application module an endpoint belongs to. Drives grouping in the UI. */
export type ModuleCategory =
  | 'auth'
  | 'permissions'
  | 'fleet'
  | 'station'
  | 'customization'
  | 'board'
  | 'gamemode'
  | 'config'
  | 'player'
  | 'roles'
  | 'moderation'
  | 'events'
  | 'server-events'
  | 'match-history'
  | 'settings'
  | 'system'

export type EndpointStatus = 'verified' | 'unverified' | 'deprecated'

/** Permission scope an endpoint requires. Maps to PermissionSet via scopeToFlag(). */
export type PermissionScope =
  | 'none'
  | 'read'
  | 'write'
  | 'moderation'
  | 'player-management'
  | 'role-management'
  | 'customization'
  | 'events'

export interface ParamDef {
  name: string
  in: 'path' | 'query'
  required: boolean
  description?: string
  example?: string | number | boolean
}

/**
 * A single API endpoint described as data. This is the ONLY place a URL/method lives —
 * the client, Endpoint Explorer, Dev Mode, and doc generator all read from here.
 *
 * To add a newly discovered endpoint: append one object to `endpoints` in
 * ./endpoints.ts. No other code changes are required for it to become callable,
 * searchable, testable, and documented.
 */
export interface EndpointDef {
  /** Stable machine id, dot-namespaced by module, e.g. "fleet.list". */
  id: string
  name: string
  description: string
  category: ModuleCategory
  method: HttpMethod
  /** Path relative to the configured base URL. Supports ":token" path params. */
  path: string
  params?: ParamDef[]
  requiresAuth: boolean
  permission: PermissionScope
  fleetScoped?: boolean
  stationScoped?: boolean
  requestExample?: unknown
  responseExample?: unknown
  /** Map of HTTP status code -> meaning. */
  statusCodes?: Record<number, string>
  status: EndpointStatus
  /** Free-form note, e.g. why it is unverified or how it was discovered. */
  notes?: string
  /** ISO timestamp of the last successful test, set at runtime by the tester. */
  lastTested?: string
}
