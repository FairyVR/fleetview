# FleetView — Discovered API Endpoint Registry

_Auto-generated from `src/shared/registry/endpoints.ts` on 2026-07-21T02:20:22.339Z._

**32** endpoints registered · **25** verified · **7** unverified.

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
| `roles.list` | GET | `/v1/fleets/:fleetId/roles` | yes | role:read | verified |
| `roles.members` | GET | `/v2/fleets/:fleetId/roles/:roleId/users` | yes | role:read | verified |
| `roles.create` | POST | `/v1/fleets/:fleetId/roles` | yes | role:write | unverified |
| `roles.updatePermissions` | PATCH | `/v1/fleets/:fleetId/roles/:roleId/permissions` | yes | role:write | unverified |
| `roles.delete` | DELETE | `/v1/fleets/:fleetId/roles/:roleId` | yes | role:write | unverified |
| `roles.assign` | POST | `/v1/fleets/:fleetId/users/:userId/roles/:roleId` | yes | role:write | unverified |
| `roles.unassign` | DELETE | `/v1/fleets/:fleetId/users/:userId/role/:roleId` | yes | role:write | unverified |
| `user.get` | GET | `/v2/users/:userId` | yes | user_data:read | verified |
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
- **Parameters:**
  - `include_config` (query) — e.g. `true`
  - `include_stations` (query) — e.g. `true`
  - `include_offline_fleets` (query) — e.g. `false`
  - `page` (query) — e.g. `1`
  - `page_size` (query) — e.g. `32`
- **Example response:**

  ```json
  {
    "page": {
      "total_items": 48,
      "item_count": 16,
      "page_size": 32,
      "page": 1,
      "pages": 2
    },
    "items": [
      {
        "fleet_id": "8a976a05-…",
        "fleet_name": "Strike",
        "created": "2023-12-14T00:51:28Z",
        "config": null,
        "stations": [
          {
            "station_id": "4efcd465-…",
            "station_name": "63D2_Phoebe_Equinox",
            "region": "eu-central-1",
            "online": true,
            "player_count": 3,
            "version": "65289",
            "session_id": "ORCHESTRATOR-…"
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
  - `include_fleet_config` (query) — e.g. `true`
  - `include_event_config` (query) — e.g. `false`

### Set station config — `station.config.set`

Write the station config JSON (also how board textures / gamemode overrides are saved).

- **Method / Path:** `POST /v2/stations/:stationId/config`
- **Auth required:** yes
- **Permission scope:** station_config:write
- **Status:** verified
- **Station-scoped**
- **Parameters:**
  - `stationId` (path) — required — e.g. `stn_1`
  - `include_fleet_config` (query) — e.g. `true`
  - `include_event_config` (query) — e.g. `false`
- **Example request body:**

  ```json
  {
    "loadedgamemodes.1200_full_2.modulestate.dashboardconfigoverrides.buseteam0whitelist": "true",
    "config.stationConfig.BoardTextureUrl0": "https://…/a.png"
  }
  ```
- **Notes:** Body is a FLAT dotted-key map — no `config` wrapper — with ALL values as strings, and only the changed keys (partial update). Wrapped/typed/full-blob bodies 422. Verified from the working StrikeTournamentTool bot.

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
- **Status:** verified
- **Fleet-scoped**
- **Parameters:**
  - `fleetId` (path) — required — e.g. `global`
- **Example response:**

  ```json
  {
    "roles": [
      {
        "role_id": "ee2b742e-2c02-4832-a8be-0a0c9d800225",
        "fleet_id": "a93461f2-…",
        "role_name": "Player",
        "role_description": "Allows a user to join a private fleet",
        "permissions": [
          "fleet:join"
        ]
      }
    ]
  }
  ```
- **Notes:** Live-verified 2026-07-18 against /v1 (v2/v3 404). Response wrapped in `roles`.

### List users with a role — `roles.members`

All users in a fleet who currently hold a given role.

- **Method / Path:** `GET /v2/fleets/:fleetId/roles/:roleId/users`
- **Auth required:** yes
- **Permission scope:** role:read
- **Status:** verified
- **Fleet-scoped**
- **Parameters:**
  - `fleetId` (path) — required — e.g. `flt_1`
  - `roleId` (path) — required — e.g. `rol_1`
- **Notes:** Live-confirmed 2026-07-20: the reliable way to list a role’s members — the v3 user list returns roles:null. Response is the fleet users holding this role.

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
- **Status codes:** `200` OK, `401` Invalid Permissions — needs GLOBAL user_data:read
- **Notes:** Requires the global user_data:read scope (fleet-level user_data:read is not enough); the 401 body names the missing scope.

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
- **Example response:**

  ```json
  {
    "page": {
      "total_items": 91,
      "item_count": 91,
      "page_size": 100,
      "page": 1,
      "pages": 1
    },
    "items": [
      {
        "user_id": "9128452633859618",
        "username": "Dozy_daisy",
        "discord_id": null,
        "platform": "meta",
        "created": "2026-07-16T22:57:18Z",
        "last_login": "2026-07-17T21:57:44Z",
        "roles": null,
        "ban": null,
        "accepted_tos_version": null
      }
    ]
  }
  ```
- **Notes:** Live-verified 2026-07-18: 200 with usernames + last_login. (/v2/fleets/{id}/users also exists but returns a smaller member subset.)

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
- **Example response:**

  ```json
  {
    "bans": [
      {
        "ban_id": "3602fd75-…",
        "user_id": "6807043526078982",
        "username": "SomePlayer",
        "fleet_id": "6c9d1fe1-…",
        "timestamp": "2026-06-08T01:40:29Z",
        "expiration": null,
        "reason": "username",
        "revoked": false,
        "created_by": "24057280…"
      }
    ]
  }
  ```

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
  - `event_type` (query) — e.g. `gamemode_stopped`
  - `page` (query) — e.g. `1`
  - `page_size` (query) — e.g. `50`
- **Example response:**

  ```json
  {
    "page": {
      "total_items": 0,
      "item_count": 500,
      "page_size": 500,
      "page": 1,
      "pages": 0
    },
    "items": [
      {
        "idx": 548586423,
        "event_type": "state",
        "station_id": "bc6ad526-…",
        "event_data": "{\"players\": [...], \"districtPopulations\": {...}}",
        "timestamp": "2026-07-18T16:31:00Z"
      }
    ]
  }
  ```
- **Notes:** `event_data` is a JSON string — parse it client-side.

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
