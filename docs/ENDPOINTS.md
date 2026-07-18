# FleetView — Discovered API Endpoint Registry

_Auto-generated from `src/shared/registry/endpoints.ts` on 2026-07-18T15:52:26.703Z._

**31** endpoints registered · **22** verified · **9** unverified.

> Base URL `https://api.oriondrift.net` · auth header `x-api-key`. See `docs/API-DISCOVERY.md`.
>
> Unverified entries are placeholders whose URL/method/shape haven't been confirmed.

## Summary

| Endpoint | Method | Path | Auth | Permission | Status |
| --- | --- | --- | --- | --- | --- |
| `fleet.list` | GET | `/v2/fleets` | yes | fleet:read | verified |
| `fleet.stations` | GET | `/v2/fleets/:fleetId/stations` | yes | station:read | verified |
| `fleet.get` | GET | `/v1/fleets/:fleetId` | yes | fleet:read | unverified |
| `fleet.update` | PATCH | `/v1/fleets/:fleetId` | yes | fleet:write | unverified |
| `fleet.config.get` | GET | `/v1/fleets/:fleetId/config` | yes | fleet_config:read | verified |
| `fleet.config.set` | POST | `/v1/fleets/:fleetId/config` | yes | fleet_config:write | verified |
| `station.list` | GET | `/v2/stations` | yes | station:read | verified |
| `station.get` | GET | `/v2/stations/:stationId` | yes | station:read | verified |
| `station.update` | PATCH | `/v1/stations/:stationId` | yes | station:write | verified |
| `station.config.get` | GET | `/v2/stations/:stationId/config` | yes | station_config:read | verified |
| `station.config.set` | POST | `/v2/stations/:stationId/config` | yes | station_config:write | verified |
| `station.config.delete` | DELETE | `/v2/stations/:stationId/config` | yes | station_config:write | verified |
| `roles.list` | GET | `/v1/fleets/:fleetId/roles` | yes | role:read | unverified |
| `roles.create` | POST | `/v1/fleets/:fleetId/roles` | yes | role:write | unverified |
| `roles.updatePermissions` | PATCH | `/v1/fleets/:fleetId/roles/:roleId/permissions` | yes | role:write | unverified |
| `roles.delete` | DELETE | `/v1/fleets/:fleetId/roles/:roleId` | yes | role:write | unverified |
| `roles.assign` | POST | `/v1/fleets/:fleetId/users/:userId/roles/:roleId` | yes | role:write | unverified |
| `roles.unassign` | DELETE | `/v1/fleets/:fleetId/users/:userId/role/:roleId` | yes | role:write | unverified |
| `user.get` | GET | `/v2/users/:userId` | yes | user_data:read | verified |
| `player.search` | GET | `/v1/user_search` | yes | user_data:read | verified |
| `player.listByFleet` | GET | `/v3/fleets/:fleetId/users` | yes | user_data:read | unverified |
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
- **Parameters:**
  - `include_config` (query) — e.g. `true`
  - `include_stations` (query) — e.g. `true`
  - `include_offline_fleets` (query) — e.g. `false`
  - `page` (query) — e.g. `1`
  - `page_size` (query) — e.g. `32`
- **Example response:**

  ```json
  {
    "items": [
      {
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
    ]
  }
  ```
- **Status codes:** `200` OK, `401` Invalid key, `403` Forbidden

### Get fleet (with stations) — `fleet.get`

Fleet detail. The response `fleet.stations[]` is the station list for the fleet.

- **Method / Path:** `GET /v1/fleets/:fleetId`
- **Auth required:** yes
- **Permission scope:** fleet:read
- **Status:** unverified
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
- **Notes:** Live probing found /v2/fleets/{id} returns 404; this v1 path is unconfirmed. Prefer fleet.list / fleet.stations.

### Update fleet — `fleet.update`

Patch fleet-level settings.

- **Method / Path:** `PATCH /v1/fleets/:fleetId`
- **Auth required:** yes
- **Permission scope:** fleet:write
- **Status:** unverified
- **Fleet-scoped**
- **Parameters:**
  - `fleetId` (path) — required — e.g. `flt_1`
- **Notes:** Root fleet resource 404s on v2; v1 PATCH unconfirmed against the live API.

## station

### List fleet stations — `fleet.stations`

Paginated list of active stations running within a fleet.

- **Method / Path:** `GET /v2/fleets/:fleetId/stations`
- **Auth required:** yes
- **Permission scope:** station:read
- **Status:** verified
- **Fleet-scoped**
- **Parameters:**
  - `fleetId` (path) — required — e.g. `flt_1`
  - `page` (query) — e.g. `1`
  - `page_size` (query) — e.g. `32`
- **Example response:**

  ```json
  {
    "items": [
      {
        "station_id": "stn_1",
        "station_name": "Station One",
        "online": true
      }
    ]
  }
  ```

### List all stations (global) — `station.list`

Global paginated telemetry: every active server across all fleets, with per-zone player counts.

- **Method / Path:** `GET /v2/stations`
- **Auth required:** yes
- **Permission scope:** station:read
- **Status:** verified
- **Parameters:**
  - `page` (query) — e.g. `1`
  - `page_size` (query) — e.g. `32`

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

## roles

### List fleet roles — `roles.list`

Roles for a fleet (use fleetId "global" for global roles).

- **Method / Path:** `GET /v1/fleets/:fleetId/roles`
- **Auth required:** yes
- **Permission scope:** role:read
- **Status:** unverified
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
- **Notes:** Live probing found /v2/fleets/{id}/roles returns 404; v1 roles paths unconfirmed against the live API.

### Create role — `roles.create`

Create a role in a fleet.

- **Method / Path:** `POST /v1/fleets/:fleetId/roles`
- **Auth required:** yes
- **Permission scope:** role:write
- **Status:** unverified
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
- **Notes:** Roles resource 404s on v2; v1 path unconfirmed against the live API.

### Set role permissions — `roles.updatePermissions`

Replace a role's permission list.

- **Method / Path:** `PATCH /v1/fleets/:fleetId/roles/:roleId/permissions`
- **Auth required:** yes
- **Permission scope:** role:write
- **Status:** unverified
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
- **Notes:** Roles resource 404s on v2; v1 path unconfirmed against the live API.

### Delete role — `roles.delete`

Delete a role from a fleet.

- **Method / Path:** `DELETE /v1/fleets/:fleetId/roles/:roleId`
- **Auth required:** yes
- **Permission scope:** role:write
- **Status:** unverified
- **Fleet-scoped**
- **Parameters:**
  - `fleetId` (path) — required — e.g. `flt_1`
  - `roleId` (path) — required — e.g. `rol_1`
- **Notes:** Roles resource 404s on v2; v1 path unconfirmed against the live API.

### Assign role to user — `roles.assign`

Grant a role to a user in a fleet.

- **Method / Path:** `POST /v1/fleets/:fleetId/users/:userId/roles/:roleId`
- **Auth required:** yes
- **Permission scope:** role:write
- **Status:** unverified
- **Fleet-scoped**
- **Parameters:**
  - `fleetId` (path) — required — e.g. `flt_1`
  - `userId` (path) — required — e.g. `usr_1`
  - `roleId` (path) — required — e.g. `rol_1`
- **Notes:** Roles resource 404s on v2; v1 path unconfirmed against the live API.

### Remove role from user — `roles.unassign`

Revoke a role from a user in a fleet.

- **Method / Path:** `DELETE /v1/fleets/:fleetId/users/:userId/role/:roleId`
- **Auth required:** yes
- **Permission scope:** role:write
- **Status:** unverified
- **Fleet-scoped**
- **Parameters:**
  - `fleetId` (path) — required — e.g. `flt_1`
  - `userId` (path) — required — e.g. `usr_1`
  - `roleId` (path) — required — e.g. `rol_1`
- **Notes:** Roles resource 404s on v2; v1 path unconfirmed against the live API.

## player

### Get user (global) — `user.get`

Global player profile by id: username, account creation date, last login, ban status.

- **Method / Path:** `GET /v2/users/:userId`
- **Auth required:** yes
- **Permission scope:** user_data:read
- **Status:** verified
- **Parameters:**
  - `userId` (path) — required — e.g. `usr_1`
- **Example response:**

  ```json
  {
    "user_id": "usr_1",
    "display_name": "Nova",
    "created_at": "2025-01-01T00:00:00Z",
    "last_login": "2026-07-01T00:00:00Z",
    "banned": false
  }
  ```

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
- **Status:** unverified
- **Fleet-scoped**
- **Parameters:**
  - `fleetId` (path) — required — e.g. `flt_1`
  - `search_string` (query) — e.g. `nova`
  - `page` (query) — e.g. `1`
  - `page_size` (query) — e.g. `16`
  - `include_roles` (query) — e.g. `true`
- **Notes:** Live probing found /v2/fleets/{id}/players returns 404; this v3 path is unconfirmed. user.get works globally.

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
