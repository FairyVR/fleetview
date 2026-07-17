import type { EndpointDef } from './types'

/**
 * Endpoint registry.
 *
 * IMPORTANT: These entries are UNVERIFIED placeholders. The real Orion Drift dashboard
 * API was not available to inspect, so no URL/method/shape here has been confirmed
 * against a live server. They exist so the app runs end-to-end and demonstrates the
 * shape a verified entry should take.
 *
 * To add a real endpoint discovered from the official dashboard (see
 * docs/API-DISCOVERY.md): copy one of these, fill in the true path/method/params,
 * set `status: 'verified'`, and remove the placeholder note. Everything else in the app
 * updates automatically.
 */
const UNVERIFIED =
  'Placeholder — not confirmed against a live server. Replace with a verified definition captured from the official dashboard.'

export const endpoints: EndpointDef[] = [
  // ── Auth / identity ────────────────────────────────────────────────
  {
    id: 'auth.whoami',
    name: 'Who am I',
    description: 'Returns the identity/owner associated with the authenticated API key.',
    category: 'auth',
    method: 'GET',
    path: '/v1/me',
    requiresAuth: true,
    permission: 'read',
    responseExample: { id: 'usr_123', name: 'ExampleOwner', platform: 'meta' },
    statusCodes: { 200: 'OK', 401: 'Invalid or expired key' },
    status: 'unverified',
    notes: UNVERIFIED
  },

  // ── Permissions discovery ──────────────────────────────────────────
  {
    id: 'permissions.summary',
    name: 'Permission summary',
    description: 'Lists the scopes, fleets, and stations the authenticated key can access.',
    category: 'permissions',
    method: 'GET',
    path: '/v1/permissions',
    requiresAuth: true,
    permission: 'read',
    responseExample: {
      scopes: ['read', 'write', 'moderation'],
      fleets: ['flt_1'],
      stations: ['stn_1', 'stn_2']
    },
    statusCodes: { 200: 'OK', 401: 'Unauthorized', 403: 'Forbidden' },
    status: 'unverified',
    notes: UNVERIFIED
  },

  // ── Fleet ──────────────────────────────────────────────────────────
  {
    id: 'fleet.list',
    name: 'List fleets',
    description: 'All fleets accessible to the authenticated key.',
    category: 'fleet',
    method: 'GET',
    path: '/v1/fleets',
    requiresAuth: true,
    permission: 'read',
    responseExample: [
      { id: 'flt_1', name: 'Alpha Fleet', region: 'us-east', stationCount: 3 }
    ],
    statusCodes: { 200: 'OK', 401: 'Unauthorized' },
    status: 'unverified',
    notes: UNVERIFIED
  },
  {
    id: 'fleet.get',
    name: 'Get fleet',
    description: 'Details for a single fleet.',
    category: 'fleet',
    method: 'GET',
    path: '/v1/fleets/:fleetId',
    params: [{ name: 'fleetId', in: 'path', required: true, example: 'flt_1' }],
    requiresAuth: true,
    permission: 'read',
    fleetScoped: true,
    status: 'unverified',
    notes: UNVERIFIED
  },

  // ── Station ────────────────────────────────────────────────────────
  {
    id: 'station.list',
    name: 'List stations',
    description: 'Stations belonging to a fleet.',
    category: 'station',
    method: 'GET',
    path: '/v1/fleets/:fleetId/stations',
    params: [{ name: 'fleetId', in: 'path', required: true, example: 'flt_1' }],
    requiresAuth: true,
    permission: 'read',
    fleetScoped: true,
    responseExample: [
      { id: 'stn_1', name: 'Station One', status: 'online', playerCount: 4, version: '1.2.3' }
    ],
    status: 'unverified',
    notes: UNVERIFIED
  },
  {
    id: 'station.get',
    name: 'Get station',
    description: 'Full detail + live status for a single station.',
    category: 'station',
    method: 'GET',
    path: '/v1/stations/:stationId',
    params: [{ name: 'stationId', in: 'path', required: true, example: 'stn_1' }],
    requiresAuth: true,
    permission: 'read',
    stationScoped: true,
    status: 'unverified',
    notes: UNVERIFIED
  },
  {
    id: 'station.updateConfig',
    name: 'Update station config',
    description: 'Writes the full/partial config object for a station.',
    category: 'station',
    method: 'PATCH',
    path: '/v1/stations/:stationId/config',
    params: [{ name: 'stationId', in: 'path', required: true, example: 'stn_1' }],
    requiresAuth: true,
    permission: 'write',
    stationScoped: true,
    requestExample: { config: { maxPlayers: 8 } },
    statusCodes: { 200: 'Saved', 403: 'Missing write permission', 422: 'Invalid config' },
    status: 'unverified',
    notes: UNVERIFIED
  },

  // ── Board / customization ──────────────────────────────────────────
  {
    id: 'board.get',
    name: 'Get board textures',
    description: 'Current BoardTextureUrl values for every board slot on a station.',
    category: 'board',
    method: 'GET',
    path: '/v1/stations/:stationId/boards',
    params: [{ name: 'stationId', in: 'path', required: true, example: 'stn_1' }],
    requiresAuth: true,
    permission: 'customization',
    stationScoped: true,
    responseExample: {
      slots: [{ key: 'BoardTextureUrl0', name: 'Board 0', textureUrl: 'https://…/a.png' }]
    },
    status: 'unverified',
    notes: UNVERIFIED
  },
  {
    id: 'board.set',
    name: 'Set board texture',
    description: 'Sets the texture URL for one board slot.',
    category: 'board',
    method: 'PUT',
    path: '/v1/stations/:stationId/boards/:slotKey',
    params: [
      { name: 'stationId', in: 'path', required: true, example: 'stn_1' },
      { name: 'slotKey', in: 'path', required: true, example: 'BoardTextureUrl0' }
    ],
    requiresAuth: true,
    permission: 'customization',
    stationScoped: true,
    requestExample: { textureUrl: 'https://…/new.png' },
    status: 'unverified',
    notes: UNVERIFIED
  },

  // ── Gamemode ───────────────────────────────────────────────────────
  {
    id: 'gamemode.list',
    name: 'List gamemodes',
    description: 'Loaded gamemodes with arena keys and override parameters.',
    category: 'gamemode',
    method: 'GET',
    path: '/v1/stations/:stationId/gamemodes',
    params: [{ name: 'stationId', in: 'path', required: true, example: 'stn_1' }],
    requiresAuth: true,
    permission: 'read',
    stationScoped: true,
    status: 'unverified',
    notes: UNVERIFIED
  },
  {
    id: 'gamemode.setOverrides',
    name: 'Set gamemode overrides',
    description: 'Writes override parameter values for a gamemode.',
    category: 'gamemode',
    method: 'PUT',
    path: '/v1/stations/:stationId/gamemodes/:gamemodeKey',
    params: [
      { name: 'stationId', in: 'path', required: true, example: 'stn_1' },
      { name: 'gamemodeKey', in: 'path', required: true, example: 'deathmatch' }
    ],
    requiresAuth: true,
    permission: 'write',
    stationScoped: true,
    requestExample: { overrides: { scoreLimit: 25 } },
    status: 'unverified',
    notes: UNVERIFIED
  },

  // ── Player ─────────────────────────────────────────────────────────
  {
    id: 'player.search',
    name: 'Search players',
    description: 'Search players by name or id.',
    category: 'player',
    method: 'GET',
    path: '/v1/players',
    params: [{ name: 'q', in: 'query', required: false, example: 'nova' }],
    requiresAuth: true,
    permission: 'player-management',
    status: 'unverified',
    notes: UNVERIFIED
  },
  {
    id: 'player.get',
    name: 'Get player',
    description: 'A single player profile with roles and ban state.',
    category: 'player',
    method: 'GET',
    path: '/v1/players/:playerId',
    params: [{ name: 'playerId', in: 'path', required: true, example: 'ply_1' }],
    requiresAuth: true,
    permission: 'player-management',
    status: 'unverified',
    notes: UNVERIFIED
  },

  // ── Roles ──────────────────────────────────────────────────────────
  {
    id: 'roles.list',
    name: 'List roles',
    description: 'All assignable roles.',
    category: 'roles',
    method: 'GET',
    path: '/v1/roles',
    requiresAuth: true,
    permission: 'role-management',
    status: 'unverified',
    notes: UNVERIFIED
  },
  {
    id: 'roles.assign',
    name: 'Assign role',
    description: 'Assigns a role to a player.',
    category: 'roles',
    method: 'POST',
    path: '/v1/players/:playerId/roles',
    params: [{ name: 'playerId', in: 'path', required: true, example: 'ply_1' }],
    requiresAuth: true,
    permission: 'role-management',
    requestExample: { roleId: 'rol_mod' },
    status: 'unverified',
    notes: UNVERIFIED
  },

  // ── Moderation ─────────────────────────────────────────────────────
  {
    id: 'moderation.ban',
    name: 'Ban player',
    description: 'Bans a player from a fleet/station.',
    category: 'moderation',
    method: 'POST',
    path: '/v1/moderation/bans',
    requiresAuth: true,
    permission: 'moderation',
    requestExample: { playerId: 'ply_1', reason: 'cheating', durationHours: 24 },
    status: 'unverified',
    notes: UNVERIFIED
  },
  {
    id: 'moderation.unban',
    name: 'Unban player',
    description: 'Removes a ban.',
    category: 'moderation',
    method: 'DELETE',
    path: '/v1/moderation/bans/:banId',
    params: [{ name: 'banId', in: 'path', required: true, example: 'ban_1' }],
    requiresAuth: true,
    permission: 'moderation',
    status: 'unverified',
    notes: UNVERIFIED
  },
  {
    id: 'moderation.kick',
    name: 'Kick player',
    description: 'Kicks a player from their current session.',
    category: 'moderation',
    method: 'POST',
    path: '/v1/stations/:stationId/kick',
    params: [{ name: 'stationId', in: 'path', required: true, example: 'stn_1' }],
    requiresAuth: true,
    permission: 'moderation',
    stationScoped: true,
    requestExample: { playerId: 'ply_1' },
    status: 'unverified',
    notes: UNVERIFIED
  },

  // ── Server events ──────────────────────────────────────────────────
  {
    id: 'events.list',
    name: 'List server events',
    description: 'Recent server events for a station (polled).',
    category: 'server-events',
    method: 'GET',
    path: '/v1/stations/:stationId/events',
    params: [
      { name: 'stationId', in: 'path', required: true, example: 'stn_1' },
      { name: 'since', in: 'query', required: false, example: 0 }
    ],
    requiresAuth: true,
    permission: 'events',
    stationScoped: true,
    status: 'unverified',
    notes: UNVERIFIED
  },

  // ── Match history ──────────────────────────────────────────────────
  {
    id: 'matches.list',
    name: 'List matches',
    description: 'Match history for a station.',
    category: 'match-history',
    method: 'GET',
    path: '/v1/stations/:stationId/matches',
    params: [{ name: 'stationId', in: 'path', required: true, example: 'stn_1' }],
    requiresAuth: true,
    permission: 'read',
    stationScoped: true,
    status: 'unverified',
    notes: UNVERIFIED
  },
  {
    id: 'matches.get',
    name: 'Get match',
    description: 'Full detail for a single match, including player stats.',
    category: 'match-history',
    method: 'GET',
    path: '/v1/matches/:matchId',
    params: [{ name: 'matchId', in: 'path', required: true, example: 'mtc_1' }],
    requiresAuth: true,
    permission: 'read',
    status: 'unverified',
    notes: UNVERIFIED
  }
]
