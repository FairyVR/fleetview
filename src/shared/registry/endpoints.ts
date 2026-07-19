import type { EndpointDef } from './types'

/**
 * Endpoint registry — Orion Drift API.
 *
 * Base URL: https://api.oriondrift.net   Auth header: `x-api-key: <key>`
 *
 * Paths, methods, path params, auth scheme and the permission scope names below were
 * extracted from the official dashboard's own API client (openapi-fetch) at
 * dashboard.oriondrift.net, so they are `verified` for URL/method/auth. Response shapes
 * are inferred from how the dashboard consumes them (`.data.roles`, `.data.items`, …) and
 * may need tightening once observed live.
 *
 * Real API scoping (important):
 *  - Fleet-scoped: roles, users/players, bans, reports, events, fleet config.
 *  - Station-scoped: station detail + station config (board textures and gamemode
 *    overrides live INSIDE the station config JSON — there is no separate boards or
 *    gamemodes endpoint).
 *  - Global: fleet list, user search.
 * There is no kick or "match history" REST endpoint in the dashboard API.
 */

export const endpoints: EndpointDef[] = [
  // ── Fleets ─────────────────────────────────────────────────────────
  {
    id: 'fleet.list',
    name: 'List fleets',
    description: 'All fleets the authenticated key can access (used to validate a key).',
    category: 'fleet',
    method: 'GET',
    path: '/v2/fleets',
    params: [
      { name: 'include_config', in: 'query', required: false, example: true },
      { name: 'include_stations', in: 'query', required: false, example: true },
      { name: 'include_offline_fleets', in: 'query', required: false, example: false },
      { name: 'page', in: 'query', required: false, example: 1 },
      { name: 'page_size', in: 'query', required: false, example: 32 }
    ],
    requiresAuth: true,
    permission: 'fleet:read',
    responseExample: {
      page: { total_items: 48, item_count: 16, page_size: 32, page: 1, pages: 2 },
      items: [
        {
          fleet_id: '8a976a05-…',
          fleet_name: 'Strike',
          created: '2023-12-14T00:51:28Z',
          config: null,
          stations: [
            {
              station_id: '4efcd465-…',
              station_name: '63D2_Phoebe_Equinox',
              region: 'eu-central-1',
              online: true,
              player_count: 3,
              version: '65289',
              session_id: 'ORCHESTRATOR-…'
            }
          ]
        }
      ]
    },
    statusCodes: { 200: 'OK', 401: 'Invalid key', 403: 'Forbidden' },
    status: 'verified'
  },
  {
    id: 'fleet.stations',
    name: 'List fleet stations',
    description: 'Paginated list of active stations running within a fleet.',
    category: 'station',
    method: 'GET',
    path: '/v2/fleets/:fleetId/stations',
    params: [
      { name: 'fleetId', in: 'path', required: true, example: 'flt_1' },
      { name: 'page', in: 'query', required: false, example: 1 },
      { name: 'page_size', in: 'query', required: false, example: 32 }
    ],
    requiresAuth: true,
    permission: 'station:read',
    fleetScoped: true,
    responseExample: { items: [{ station_id: 'stn_1', station_name: 'Station One', online: true }] },
    status: 'verified'
  },
  {
    id: 'fleet.get',
    name: 'Get fleet (with stations)',
    description: 'Fleet detail. The response `fleet.stations[]` is the station list for the fleet.',
    category: 'fleet',
    method: 'GET',
    path: '/v1/fleets/:fleetId',
    params: [{ name: 'fleetId', in: 'path', required: true, example: 'flt_1' }],
    requiresAuth: true,
    permission: 'fleet:read',
    fleetScoped: true,
    responseExample: {
      fleet: {
        fleet_id: 'flt_1',
        fleet_name: 'Strike',
        stations: [{ station_id: 'stn_1', station_name: 'Station One', online: true }]
      }
    },
    status: 'unverified',
    notes: 'Live probing found /v2/fleets/{id} returns 404; this v1 path is unconfirmed. Prefer fleet.list / fleet.stations.'
  },
  {
    id: 'fleet.update',
    name: 'Update fleet',
    description: 'Patch fleet-level settings.',
    category: 'fleet',
    method: 'PATCH',
    path: '/v1/fleets/:fleetId',
    params: [{ name: 'fleetId', in: 'path', required: true, example: 'flt_1' }],
    requiresAuth: true,
    permission: 'fleet:write',
    fleetScoped: true,
    status: 'unverified',
    notes: 'Root fleet resource 404s on v2; v1 PATCH unconfirmed against the live API.'
  },
  {
    id: 'fleet.config.get',
    name: 'Get fleet config',
    description: 'Fleet-level configuration object.',
    category: 'config',
    method: 'GET',
    path: '/v1/fleets/:fleetId/config',
    params: [{ name: 'fleetId', in: 'path', required: true, example: 'flt_1' }],
    requiresAuth: true,
    permission: 'fleet_config:read',
    fleetScoped: true,
    status: 'verified'
  },
  {
    id: 'fleet.config.set',
    name: 'Set fleet config',
    description: 'Write the fleet-level configuration object.',
    category: 'config',
    method: 'POST',
    path: '/v1/fleets/:fleetId/config',
    params: [{ name: 'fleetId', in: 'path', required: true, example: 'flt_1' }],
    requiresAuth: true,
    permission: 'fleet_config:write',
    fleetScoped: true,
    status: 'verified'
  },

  // ── Stations ───────────────────────────────────────────────────────
  {
    id: 'station.list',
    name: 'List all stations (global)',
    description:
      'Global paginated telemetry: every active server across all fleets, with per-zone player counts.',
    category: 'station',
    method: 'GET',
    path: '/v2/stations',
    params: [
      { name: 'page', in: 'query', required: false, example: 1 },
      { name: 'page_size', in: 'query', required: false, example: 32 }
    ],
    requiresAuth: true,
    permission: 'station:read',
    status: 'verified'
  },
  {
    id: 'station.get',
    name: 'Get station',
    description: 'Live detail for a single station.',
    category: 'station',
    method: 'GET',
    path: '/v2/stations/:stationId',
    params: [{ name: 'stationId', in: 'path', required: true, example: 'stn_1' }],
    requiresAuth: true,
    permission: 'station:read',
    stationScoped: true,
    status: 'verified'
  },
  {
    id: 'station.update',
    name: 'Update station',
    description: 'Patch station settings.',
    category: 'station',
    method: 'PATCH',
    path: '/v1/stations/:stationId',
    params: [{ name: 'stationId', in: 'path', required: true, example: 'stn_1' }],
    requiresAuth: true,
    permission: 'station:write',
    stationScoped: true,
    status: 'verified'
  },
  {
    id: 'station.config.get',
    name: 'Get station config',
    description:
      'The full station config JSON. Board textures (BoardTextureUrl*) and gamemode overrides live inside this object.',
    category: 'config',
    method: 'GET',
    path: '/v2/stations/:stationId/config',
    params: [
      { name: 'stationId', in: 'path', required: true, example: 'stn_1' },
      { name: 'include_fleet_config', in: 'query', required: false, example: true },
      { name: 'include_event_config', in: 'query', required: false, example: false }
    ],
    requiresAuth: true,
    permission: 'station_config:read',
    stationScoped: true,
    status: 'verified'
  },
  {
    id: 'station.config.set',
    name: 'Set station config',
    description: 'Write the station config JSON (also how board textures / gamemode overrides are saved).',
    category: 'config',
    method: 'POST',
    path: '/v2/stations/:stationId/config',
    params: [
      { name: 'stationId', in: 'path', required: true, example: 'stn_1' },
      { name: 'include_fleet_config', in: 'query', required: false, example: true },
      { name: 'include_event_config', in: 'query', required: false, example: false }
    ],
    requiresAuth: true,
    permission: 'station_config:write',
    stationScoped: true,
    requestExample: {
      'loadedgamemodes.1200_full_2.modulestate.dashboardconfigoverrides.buseteam0whitelist': 'true',
      'config.stationConfig.BoardTextureUrl0': 'https://…/a.png'
    },
    status: 'verified',
    notes:
      'Body is a FLAT dotted-key map — no `config` wrapper — with ALL values as strings, and only the changed keys (partial update). Wrapped/typed/full-blob bodies 422. Verified from the working StrikeTournamentTool bot.'
  },
  {
    id: 'station.config.delete',
    name: 'Reset station config',
    description: 'Delete/reset the station config override.',
    category: 'config',
    method: 'DELETE',
    path: '/v2/stations/:stationId/config',
    params: [{ name: 'stationId', in: 'path', required: true, example: 'stn_1' }],
    requiresAuth: true,
    permission: 'station_config:write',
    stationScoped: true,
    status: 'verified'
  },

  // ── Roles ──────────────────────────────────────────────────────────
  {
    id: 'roles.list',
    name: 'List fleet roles',
    description: 'Roles for a fleet (use fleetId "global" for global roles).',
    category: 'roles',
    method: 'GET',
    path: '/v1/fleets/:fleetId/roles',
    params: [{ name: 'fleetId', in: 'path', required: true, example: 'global' }],
    requiresAuth: true,
    permission: 'role:read',
    fleetScoped: true,
    responseExample: {
      roles: [
        {
          role_id: 'ee2b742e-2c02-4832-a8be-0a0c9d800225',
          fleet_id: 'a93461f2-…',
          role_name: 'Player',
          role_description: 'Allows a user to join a private fleet',
          permissions: ['fleet:join']
        }
      ]
    },
    status: 'verified',
    notes: 'Live-verified 2026-07-18 against /v1 (v2/v3 404). Response wrapped in `roles`.'
  },
  {
    id: 'roles.create',
    name: 'Create role',
    description: 'Create a role in a fleet.',
    category: 'roles',
    method: 'POST',
    path: '/v1/fleets/:fleetId/roles',
    params: [{ name: 'fleetId', in: 'path', required: true, example: 'flt_1' }],
    requiresAuth: true,
    permission: 'role:write',
    fleetScoped: true,
    requestExample: { role_name: 'Moderator', role_description: '', permissions: ['user_ban:write'] },
    status: 'unverified',
    notes: 'Roles resource 404s on v2; v1 path unconfirmed against the live API.'
  },
  {
    id: 'roles.updatePermissions',
    name: 'Set role permissions',
    description: "Replace a role's permission list.",
    category: 'roles',
    method: 'PATCH',
    path: '/v1/fleets/:fleetId/roles/:roleId/permissions',
    params: [
      { name: 'fleetId', in: 'path', required: true, example: 'flt_1' },
      { name: 'roleId', in: 'path', required: true, example: 'rol_1' }
    ],
    requiresAuth: true,
    permission: 'role:write',
    fleetScoped: true,
    requestExample: { permissions: ['user_ban:write', 'user_kick'] },
    status: 'unverified',
    notes: 'Roles resource 404s on v2; v1 path unconfirmed against the live API.'
  },
  {
    id: 'roles.delete',
    name: 'Delete role',
    description: 'Delete a role from a fleet.',
    category: 'roles',
    method: 'DELETE',
    path: '/v1/fleets/:fleetId/roles/:roleId',
    params: [
      { name: 'fleetId', in: 'path', required: true, example: 'flt_1' },
      { name: 'roleId', in: 'path', required: true, example: 'rol_1' }
    ],
    requiresAuth: true,
    permission: 'role:write',
    fleetScoped: true,
    status: 'unverified',
    notes: 'Roles resource 404s on v2; v1 path unconfirmed against the live API.'
  },
  {
    id: 'roles.assign',
    name: 'Assign role to user',
    description: 'Grant a role to a user in a fleet.',
    category: 'roles',
    method: 'POST',
    path: '/v1/fleets/:fleetId/users/:userId/roles/:roleId',
    params: [
      { name: 'fleetId', in: 'path', required: true, example: 'flt_1' },
      { name: 'userId', in: 'path', required: true, example: 'usr_1' },
      { name: 'roleId', in: 'path', required: true, example: 'rol_1' }
    ],
    requiresAuth: true,
    permission: 'role:write',
    fleetScoped: true,
    status: 'unverified',
    notes: 'Roles resource 404s on v2; v1 path unconfirmed against the live API.'
  },
  {
    id: 'roles.unassign',
    name: 'Remove role from user',
    description: 'Revoke a role from a user in a fleet.',
    category: 'roles',
    method: 'DELETE',
    path: '/v1/fleets/:fleetId/users/:userId/role/:roleId',
    params: [
      { name: 'fleetId', in: 'path', required: true, example: 'flt_1' },
      { name: 'userId', in: 'path', required: true, example: 'usr_1' },
      { name: 'roleId', in: 'path', required: true, example: 'rol_1' }
    ],
    requiresAuth: true,
    permission: 'role:write',
    fleetScoped: true,
    status: 'unverified',
    notes: 'Roles resource 404s on v2; v1 path unconfirmed against the live API.'
  },

  // ── Players / users ────────────────────────────────────────────────
  {
    id: 'user.get',
    name: 'Get user (global)',
    description:
      'Global player profile by id: username, account creation date, last login, ban status.',
    category: 'player',
    method: 'GET',
    path: '/v2/users/:userId',
    params: [{ name: 'userId', in: 'path', required: true, example: 'usr_1' }],
    requiresAuth: true,
    permission: 'user_data:read',
    responseExample: {
      user_id: 'usr_1',
      display_name: 'Nova',
      created_at: '2025-01-01T00:00:00Z',
      last_login: '2026-07-01T00:00:00Z',
      banned: false
    },
    statusCodes: { 200: 'OK', 401: 'Invalid Permissions — needs GLOBAL user_data:read' },
    status: 'verified',
    notes:
      'Requires the global user_data:read scope (fleet-level user_data:read is not enough); the 401 body names the missing scope.'
  },
  {
    id: 'player.search',
    name: 'Search users (global)',
    description: 'Global user search by name/id.',
    category: 'player',
    method: 'GET',
    path: '/v1/user_search',
    params: [{ name: 'search_string', in: 'query', required: false, example: 'nova' }],
    requiresAuth: true,
    permission: 'user_data:read',
    responseExample: { items: [{ user_id: 'usr_1', display_name: 'Nova' }] },
    status: 'verified'
  },
  {
    id: 'player.listByFleet',
    name: 'List fleet users',
    description: 'Paged users in a fleet, with roles.',
    category: 'player',
    method: 'GET',
    path: '/v3/fleets/:fleetId/users',
    params: [
      { name: 'fleetId', in: 'path', required: true, example: 'flt_1' },
      { name: 'search_string', in: 'query', required: false, example: 'nova' },
      { name: 'page', in: 'query', required: false, example: 1 },
      { name: 'page_size', in: 'query', required: false, example: 16 },
      { name: 'include_roles', in: 'query', required: false, example: true }
    ],
    requiresAuth: true,
    permission: 'user_data:read',
    fleetScoped: true,
    status: 'verified',
    responseExample: {
      page: { total_items: 91, item_count: 91, page_size: 100, page: 1, pages: 1 },
      items: [
        {
          user_id: '9128452633859618',
          username: 'Dozy_daisy',
          discord_id: null,
          platform: 'meta',
          created: '2026-07-16T22:57:18Z',
          last_login: '2026-07-17T21:57:44Z',
          roles: null,
          ban: null,
          accepted_tos_version: null
        }
      ]
    },
    notes: 'Live-verified 2026-07-18: 200 with usernames + last_login. (/v2/fleets/{id}/users also exists but returns a smaller member subset.)'
  },
  {
    id: 'player.get',
    name: 'Get fleet user',
    description: 'A single user within a fleet, incl. roles.',
    category: 'player',
    method: 'GET',
    path: '/v1/fleets/:fleetId/users/:userId',
    params: [
      { name: 'fleetId', in: 'path', required: true, example: 'flt_1' },
      { name: 'userId', in: 'path', required: true, example: 'usr_1' }
    ],
    requiresAuth: true,
    permission: 'user_data:read',
    fleetScoped: true,
    status: 'verified'
  },
  {
    id: 'player.bans',
    name: 'Get user bans',
    description: "A user's ban history within a fleet.",
    category: 'moderation',
    method: 'GET',
    path: '/v1/fleets/:fleetId/users/:userId/bans',
    params: [
      { name: 'fleetId', in: 'path', required: true, example: 'flt_1' },
      { name: 'userId', in: 'path', required: true, example: 'usr_1' }
    ],
    requiresAuth: true,
    permission: 'user_data:read',
    fleetScoped: true,
    status: 'verified'
  },

  // ── Moderation ─────────────────────────────────────────────────────
  {
    id: 'moderation.bans',
    name: 'List fleet bans',
    description: 'All bans issued in a fleet.',
    category: 'moderation',
    method: 'GET',
    path: '/v2/fleets/:fleetId/bans',
    params: [
      { name: 'fleetId', in: 'path', required: true, example: 'flt_1' },
      { name: 'include_revoked', in: 'query', required: false, example: true },
      { name: 'include_expired', in: 'query', required: false, example: true }
    ],
    requiresAuth: true,
    permission: 'user_data:read',
    fleetScoped: true,
    responseExample: {
      bans: [
        {
          ban_id: '3602fd75-…',
          user_id: '6807043526078982',
          username: 'SomePlayer',
          fleet_id: '6c9d1fe1-…',
          timestamp: '2026-06-08T01:40:29Z',
          expiration: null,
          reason: 'username',
          revoked: false,
          created_by: '24057280…'
        }
      ]
    },
    status: 'verified'
  },
  {
    id: 'moderation.ban',
    name: 'Ban user',
    description: 'Ban a user in a fleet.',
    category: 'moderation',
    method: 'POST',
    path: '/v2/fleets/:fleetId/users/:userId/ban',
    params: [
      { name: 'fleetId', in: 'path', required: true, example: 'flt_1' },
      { name: 'userId', in: 'path', required: true, example: 'usr_1' }
    ],
    requiresAuth: true,
    permission: 'user_ban:write',
    fleetScoped: true,
    requestExample: { reason: 'cheating', duration_hours: 24 },
    status: 'verified'
  },
  {
    id: 'moderation.unban',
    name: 'Unban user',
    description: 'Revoke a ban for a user in a fleet.',
    category: 'moderation',
    method: 'PATCH',
    path: '/v2/fleets/:fleetId/users/:userId/unban',
    params: [
      { name: 'fleetId', in: 'path', required: true, example: 'flt_1' },
      { name: 'userId', in: 'path', required: true, example: 'usr_1' }
    ],
    requiresAuth: true,
    permission: 'user_ban:revoke',
    fleetScoped: true,
    status: 'verified'
  },

  // ── Reports ────────────────────────────────────────────────────────
  {
    id: 'reports.list',
    name: 'List fleet reports',
    description: 'Player reports filed in a fleet.',
    category: 'moderation',
    method: 'GET',
    path: '/v2/fleets/:fleetId/reports',
    params: [
      { name: 'fleetId', in: 'path', required: true, example: 'flt_1' },
      { name: 'limit', in: 'query', required: false, example: 1000 }
    ],
    requiresAuth: true,
    permission: 'fleet_report:read',
    fleetScoped: true,
    status: 'verified'
  },

  // ── Server events ──────────────────────────────────────────────────
  {
    id: 'events.fleet',
    name: 'Fleet server events',
    description: 'Recent server events across a fleet (polled).',
    category: 'server-events',
    method: 'GET',
    path: '/v2/fleets/:fleetId/server_events',
    params: [{ name: 'fleetId', in: 'path', required: true, example: 'flt_1' }],
    requiresAuth: true,
    permission: 'server_event:read',
    fleetScoped: true,
    status: 'verified'
  },
  {
    id: 'events.station',
    name: 'Station server events',
    description: 'Recent server events for a single station (polled).',
    category: 'server-events',
    method: 'GET',
    path: '/v2/stations/:stationId/server_events',
    params: [
      { name: 'stationId', in: 'path', required: true, example: 'stn_1' },
      { name: 'event_type', in: 'query', required: false, example: 'gamemode_stopped' },
      { name: 'page', in: 'query', required: false, example: 1 },
      { name: 'page_size', in: 'query', required: false, example: 50 }
    ],
    requiresAuth: true,
    permission: 'server_event:read',
    stationScoped: true,
    responseExample: {
      page: { total_items: 0, item_count: 500, page_size: 500, page: 1, pages: 0 },
      items: [
        {
          idx: 548586423,
          event_type: 'state',
          station_id: 'bc6ad526-…',
          event_data: '{"players": [...], "districtPopulations": {...}}',
          timestamp: '2026-07-18T16:31:00Z'
        }
      ]
    },
    notes: '`event_data` is a JSON string — parse it client-side.',
    status: 'verified'
  },

  // ── Fleet events (scheduled) ───────────────────────────────────────
  {
    id: 'fleetEvents.list',
    name: 'List fleet events',
    description: 'Scheduled events for a fleet.',
    category: 'events',
    method: 'GET',
    path: '/v2/fleets/:fleetId/events',
    params: [{ name: 'fleetId', in: 'path', required: true, example: 'flt_1' }],
    requiresAuth: true,
    permission: 'server_event:read',
    fleetScoped: true,
    status: 'verified'
  },
  {
    id: 'fleetEvents.get',
    name: 'Get event',
    description: 'A single scheduled event by id.',
    category: 'events',
    method: 'GET',
    path: '/v2/events/:eventId',
    params: [{ name: 'eventId', in: 'path', required: true, example: 'evt_1' }],
    requiresAuth: true,
    permission: 'server_event:read',
    status: 'verified'
  }
]
