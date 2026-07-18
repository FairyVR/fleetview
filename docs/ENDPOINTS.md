# FleetView — Discovered API Endpoint Registry

_Auto-generated from `src/shared/registry/endpoints.ts` on 2026-07-18T15:31:27.039Z._

**28** endpoints registered · **28** verified · **0** unverified.

> Base URL `https://api.oriondrift.net` · auth header `x-api-key`. See `docs/API-DISCOVERY.md`.

## Summary

| Endpoint | Method | Path | Auth | Permission | Status |
| --- | --- | --- | --- | --- | --- |
| `fleet.list` | GET | `/v2/fleets` | yes | fleet:read | verified |
| `fleet.get` | GET | `/v1/fleets/:fleetId` | yes | fleet:read | verified |
| `fleet.update` | PATCH | `/v1/fleets/:fleetId` | yes | fleet:write | verified |
| `fleet.config.get` | GET | `/v1/fleets/:fleetId/config` | yes | fleet_config:read | verified |
| `fleet.config.set` | POST | `/v1/fleets/:fleetId/config` | yes | fleet_config:write | verified |
| `station.get` | GET | `/v2/stations/:stationId` | yes | station:read | verified |
| `station.update` | PATCH | `/v1/stations/:stationId` | yes | station:write | verified |
| `station.config.get` | GET | `/v2/stations/:stationId/config` | yes | station_config:read | verified |
| `station.config.set` | POST | `/v2/stations/:stationId/config` | yes | station_config:write | verified |
| `station.config.delete` | DELETE | `/v2/stations/:stationId/config` | yes | station_config:write | verified |
| `roles.list` | GET | `/v1/fleets/:fleetId/roles` | yes | role:read | verified |
| `roles.create` | POST | `/v1/fleets/:fleetId/roles` | yes | role:write | verified |
| `roles.updatePermissions` | PATCH | `/v1/fleets/:fleetId/roles/:roleId/permissions` | yes | role:write | verified |
| `roles.delete` | DELETE | `/v1/fleets/:fleetId/roles/:roleId` | yes | role:write | verified |
| `roles.assign` | POST | `/v1/fleets/:fleetId/users/:userId/roles/:roleId` | yes | role:write | verified |
| `roles.unassign` | DELETE | `/v1/fleets/:fleetId/users/:userId/role/:roleId` | yes | role:write | verified |
| `player.search` | GET | `/v1/user_search` | yes | user_data:read | verified |
| `player.listByFleet` | GET | `/v3/fleets/:fleetId/users` | yes | user_data:read | verified |
| `player.get` | GET | `/v1/fleets/:fleetId/users/:userId` | yes | user_data:read | verified |
| `player.bans` | GET | `/v1/fleets/:fleetId/users/:userId/bans` | yes | user_data:read | verified |
| `moderation.bans` | GET | `/v2/fleets/:fleetId/bans` | yes | user_data:read | verified |
| `moderation.ban` | POST | `/v2/fleets/:fleetId/users/:userId/ban` | yes | user_ban:write | verified |
| `moderation.unban` | PATCH | `/v2/fleets/:fleetId/users/:userId/unban` | yes | user_ban:revoke | verified |
| `reports.list` | GET | `/v2/fleets/:fleetId/reports` | yes | fleet_report:read | verified |
| `events.fleet` | GET | `/v2/fleets/:fleetId/server_events` | yes | server_event:read | verified |
| `events.station` | GET | `/v2/stations/:stationId/server_events` | yes | server_event:read | verified |
| `fleetEvents.list` | GET | `/v2/fleets/:fleetId/events` | yes | server_event:read | verified |
| `fleetEvents.get` | GET | `/v2/events/:eventId` | yes | server_event:read | verified |

## fleet

### List fleets — `fleet.list`

All fleets the authenticated key can access (used to validate a key).

- **Method / Path:** `GET /v2/fleets`
- **Auth required:** yes
- **Permission scope:** fleet:read
- **Status:** verified
- **Example response:**

  ```json
  {
    "fleets": [
      {
        "fleet_id": "flt_1",
        "fleet_name": "Strike",
        "stations": []
      }
    ]
  }
  ```
- **Status codes:** `200` OK, `401` Invalid key, `403` Forbidden

### Get fleet (with stations) — `fleet.get`

Fleet detail. The response `fleet.stations[]` is the station list for the fleet.

- **Method / Path:** `GET /v1/fleets/:fleetId`
- **Auth required:** yes
- **Permission scope:** fleet:read
- **Status:** verified
- **Fleet-scoped**
- **Parameters:**
  - `fleetId` (path) — required — e.g. `flt_1`
- **Example response:**

  ```json
  {
    "fleet": {
      "fleet_id": "flt_1",
      "fleet_name": "Strike",
      "stations": [
        {
          "station_id": "stn_1",
          "station_name": "Station One",
          "online": true
        }
      ]
    }
  }
  ```

### Update fleet — `fleet.update`

Patch fleet-level settings.

- **Method / Path:** `PATCH /v1/fleets/:fleetId`
- **Auth required:** yes
- **Permission scope:** fleet:write
- **Status:** verified
- **Fleet-scoped**
- **Parameters:**
  - `fleetId` (path) — required — e.g. `flt_1`

## config

### Get fleet config — `fleet.config.get`

Fleet-level configuration object.

- **Method / Path:** `GET /v1/fleets/:fleetId/config`
- **Auth required:** yes
- **Permission scope:** fleet_config:read
- **Status:** verified
- **Fleet-scoped**
- **Parameters:**
  - `fleetId` (path) — required — e.g. `flt_1`

### Set fleet config — `fleet.config.set`

Write the fleet-level configuration object.

- **Method / Path:** `POST /v1/fleets/:fleetId/config`
- **Auth required:** yes
- **Permission scope:** fleet_config:write
- **Status:** verified
- **Fleet-scoped**
- **Parameters:**
  - `fleetId` (path) — required — e.g. `flt_1`

### Get station config — `station.config.get`

The full station config JSON. Board textures (BoardTextureUrl*) and gamemode overrides live inside this object.

- **Method / Path:** `GET /v2/stations/:stationId/config`
- **Auth required:** yes
- **Permission scope:** station_config:read
- **Status:** verified
- **Station-scoped**
- **Parameters:**
  - `stationId` (path) — required — e.g. `stn_1`

### Set station config — `station.config.set`

Write the station config JSON (also how board textures / gamemode overrides are saved).

- **Method / Path:** `POST /v2/stations/:stationId/config`
- **Auth required:** yes
- **Permission scope:** station_config:write
- **Status:** verified
- **Station-scoped**
- **Parameters:**
  - `stationId` (path) — required — e.g. `stn_1`
- **Example request body:**

  ```json
  {
    "config": {
      "BoardTextureUrl0": "https://…/a.png"
    }
  }
  ```

### Reset station config — `station.config.delete`

Delete/reset the station config override.

- **Method / Path:** `DELETE /v2/stations/:stationId/config`
- **Auth required:** yes
- **Permission scope:** station_config:write
- **Status:** verified
- **Station-scoped**
- **Parameters:**
  - `stationId` (path) — required — e.g. `stn_1`

## station

### Get station — `station.get`

Live detail for a single station.

- **Method / Path:** `GET /v2/stations/:stationId`
- **Auth required:** yes
- **Permission scope:** station:read
- **Status:** verified
- **Station-scoped**
- **Parameters:**
  - `stationId` (path) — required — e.g. `stn_1`

### Update station — `station.update`

Patch station settings.

- **Method / Path:** `PATCH /v1/stations/:stationId`
- **Auth required:** yes
- **Permission scope:** station:write
- **Status:** verified
- **Station-scoped**
- **Parameters:**
  - `stationId` (path) — required — e.g. `stn_1`

## roles

### List fleet roles — `roles.list`

Roles for a fleet (use fleetId "global" for global roles).

- **Method / Path:** `GET /v1/fleets/:fleetId/roles`
- **Auth required:** yes
- **Permission scope:** role:read
- **Status:** verified
- **Fleet-scoped**
- **Parameters:**
  - `fleetId` (path) — required — e.g. `global`
- **Example response:**

  ```json
  {
    "roles": [
      {
        "role_id": "rol_1",
        "role_name": "Moderator",
        "role_description": "",
        "permissions": [
          "user_ban:write"
        ]
      }
    ]
  }
  ```

### Create role — `roles.create`

Create a role in a fleet.

- **Method / Path:** `POST /v1/fleets/:fleetId/roles`
- **Auth required:** yes
- **Permission scope:** role:write
- **Status:** verified
- **Fleet-scoped**
- **Parameters:**
  - `fleetId` (path) — required — e.g. `flt_1`
- **Example request body:**

  ```json
  {
    "role_name": "Moderator",
    "role_description": "",
    "permissions": [
      "user_ban:write"
    ]
  }
  ```

### Set role permissions — `roles.updatePermissions`

Replace a role's permission list.

- **Method / Path:** `PATCH /v1/fleets/:fleetId/roles/:roleId/permissions`
- **Auth required:** yes
- **Permission scope:** role:write
- **Status:** verified
- **Fleet-scoped**
- **Parameters:**
  - `fleetId` (path) — required — e.g. `flt_1`
  - `roleId` (path) — required — e.g. `rol_1`
- **Example request body:**

  ```json
  {
    "permissions": [
      "user_ban:write",
      "user_kick"
    ]
  }
  ```

### Delete role — `roles.delete`

Delete a role from a fleet.

- **Method / Path:** `DELETE /v1/fleets/:fleetId/roles/:roleId`
- **Auth required:** yes
- **Permission scope:** role:write
- **Status:** verified
- **Fleet-scoped**
- **Parameters:**
  - `fleetId` (path) — required — e.g. `flt_1`
  - `roleId` (path) — required — e.g. `rol_1`

### Assign role to user — `roles.assign`

Grant a role to a user in a fleet.

- **Method / Path:** `POST /v1/fleets/:fleetId/users/:userId/roles/:roleId`
- **Auth required:** yes
- **Permission scope:** role:write
- **Status:** verified
- **Fleet-scoped**
- **Parameters:**
  - `fleetId` (path) — required — e.g. `flt_1`
  - `userId` (path) — required — e.g. `usr_1`
  - `roleId` (path) — required — e.g. `rol_1`

### Remove role from user — `roles.unassign`

Revoke a role from a user in a fleet.

- **Method / Path:** `DELETE /v1/fleets/:fleetId/users/:userId/role/:roleId`
- **Auth required:** yes
- **Permission scope:** role:write
- **Status:** verified
- **Fleet-scoped**
- **Parameters:**
  - `fleetId` (path) — required — e.g. `flt_1`
  - `userId` (path) — required — e.g. `usr_1`
  - `roleId` (path) — required — e.g. `rol_1`

## player

### Search users (global) — `player.search`

Global user search by name/id.

- **Method / Path:** `GET /v1/user_search`
- **Auth required:** yes
- **Permission scope:** user_data:read
- **Status:** verified
- **Parameters:**
  - `search_string` (query) — e.g. `nova`
- **Example response:**

  ```json
  {
    "items": [
      {
        "user_id": "usr_1",
        "display_name": "Nova"
      }
    ]
  }
  ```

### List fleet users — `player.listByFleet`

Paged users in a fleet, with roles.

- **Method / Path:** `GET /v3/fleets/:fleetId/users`
- **Auth required:** yes
- **Permission scope:** user_data:read
- **Status:** verified
- **Fleet-scoped**
- **Parameters:**
  - `fleetId` (path) — required — e.g. `flt_1`
  - `search_string` (query) — e.g. `nova`
  - `page` (query) — e.g. `1`
  - `page_size` (query) — e.g. `16`
  - `include_roles` (query) — e.g. `true`

### Get fleet user — `player.get`

A single user within a fleet, incl. roles.

- **Method / Path:** `GET /v1/fleets/:fleetId/users/:userId`
- **Auth required:** yes
- **Permission scope:** user_data:read
- **Status:** verified
- **Fleet-scoped**
- **Parameters:**
  - `fleetId` (path) — required — e.g. `flt_1`
  - `userId` (path) — required — e.g. `usr_1`

## moderation

### Get user bans — `player.bans`

A user's ban history within a fleet.

- **Method / Path:** `GET /v1/fleets/:fleetId/users/:userId/bans`
- **Auth required:** yes
- **Permission scope:** user_data:read
- **Status:** verified
- **Fleet-scoped**
- **Parameters:**
  - `fleetId` (path) — required — e.g. `flt_1`
  - `userId` (path) — required — e.g. `usr_1`

### List fleet bans — `moderation.bans`

All bans issued in a fleet.

- **Method / Path:** `GET /v2/fleets/:fleetId/bans`
- **Auth required:** yes
- **Permission scope:** user_data:read
- **Status:** verified
- **Fleet-scoped**
- **Parameters:**
  - `fleetId` (path) — required — e.g. `flt_1`
  - `include_revoked` (query) — e.g. `true`
  - `include_expired` (query) — e.g. `true`

### Ban user — `moderation.ban`

Ban a user in a fleet.

- **Method / Path:** `POST /v2/fleets/:fleetId/users/:userId/ban`
- **Auth required:** yes
- **Permission scope:** user_ban:write
- **Status:** verified
- **Fleet-scoped**
- **Parameters:**
  - `fleetId` (path) — required — e.g. `flt_1`
  - `userId` (path) — required — e.g. `usr_1`
- **Example request body:**

  ```json
  {
    "reason": "cheating",
    "duration_hours": 24
  }
  ```

### Unban user — `moderation.unban`

Revoke a ban for a user in a fleet.

- **Method / Path:** `PATCH /v2/fleets/:fleetId/users/:userId/unban`
- **Auth required:** yes
- **Permission scope:** user_ban:revoke
- **Status:** verified
- **Fleet-scoped**
- **Parameters:**
  - `fleetId` (path) — required — e.g. `flt_1`
  - `userId` (path) — required — e.g. `usr_1`

### List fleet reports — `reports.list`

Player reports filed in a fleet.

- **Method / Path:** `GET /v2/fleets/:fleetId/reports`
- **Auth required:** yes
- **Permission scope:** fleet_report:read
- **Status:** verified
- **Fleet-scoped**
- **Parameters:**
  - `fleetId` (path) — required — e.g. `flt_1`
  - `limit` (query) — e.g. `1000`

## server-events

### Fleet server events — `events.fleet`

Recent server events across a fleet (polled).

- **Method / Path:** `GET /v2/fleets/:fleetId/server_events`
- **Auth required:** yes
- **Permission scope:** server_event:read
- **Status:** verified
- **Fleet-scoped**
- **Parameters:**
  - `fleetId` (path) — required — e.g. `flt_1`

### Station server events — `events.station`

Recent server events for a single station (polled).

- **Method / Path:** `GET /v2/stations/:stationId/server_events`
- **Auth required:** yes
- **Permission scope:** server_event:read
- **Status:** verified
- **Station-scoped**
- **Parameters:**
  - `stationId` (path) — required — e.g. `stn_1`

## events

### List fleet events — `fleetEvents.list`

Scheduled events for a fleet.

- **Method / Path:** `GET /v2/fleets/:fleetId/events`
- **Auth required:** yes
- **Permission scope:** server_event:read
- **Status:** verified
- **Fleet-scoped**
- **Parameters:**
  - `fleetId` (path) — required — e.g. `flt_1`

### Get event — `fleetEvents.get`

A single scheduled event by id.

- **Method / Path:** `GET /v2/events/:eventId`
- **Auth required:** yes
- **Permission scope:** server_event:read
- **Status:** verified
- **Parameters:**
  - `eventId` (path) — required — e.g. `evt_1`
