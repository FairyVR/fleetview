# FleetView — Discovered API Endpoint Registry

_Auto-generated from `src/shared/registry/endpoints.ts` on 2026-07-18T07:35:53.300Z._

**21** endpoints registered · **0** verified · **21** unverified.

> Unverified endpoints are placeholders; their URL/method/shape have not been confirmed against a live server. See `docs/API-DISCOVERY.md`.

## Summary

| Endpoint | Method | Path | Auth | Permission | Status |
| --- | --- | --- | --- | --- | --- |
| `auth.whoami` | GET | `/v1/me` | yes | none | unverified |
| `permissions.summary` | GET | `/v1/permissions` | yes | none | unverified |
| `fleet.list` | GET | `/v1/fleets` | yes | fleet:read | unverified |
| `fleet.get` | GET | `/v1/fleets/:fleetId` | yes | fleet:read | unverified |
| `station.list` | GET | `/v1/fleets/:fleetId/stations` | yes | station:read | unverified |
| `station.get` | GET | `/v1/stations/:stationId` | yes | station:read | unverified |
| `station.updateConfig` | PATCH | `/v1/stations/:stationId/config` | yes | station_config:write | unverified |
| `board.get` | GET | `/v1/stations/:stationId/boards` | yes | station_config:read | unverified |
| `board.set` | PUT | `/v1/stations/:stationId/boards/:slotKey` | yes | custom_config:write | unverified |
| `gamemode.list` | GET | `/v1/stations/:stationId/gamemodes` | yes | station_config:read | unverified |
| `gamemode.setOverrides` | PUT | `/v1/stations/:stationId/gamemodes/:gamemodeKey` | yes | station_config:write | unverified |
| `player.search` | GET | `/v1/players` | yes | user_data:read | unverified |
| `player.get` | GET | `/v1/players/:playerId` | yes | user_data:read | unverified |
| `roles.list` | GET | `/v1/roles` | yes | role:read | unverified |
| `roles.assign` | POST | `/v1/players/:playerId/roles` | yes | role:write | unverified |
| `moderation.ban` | POST | `/v1/moderation/bans` | yes | user_ban:write | unverified |
| `moderation.unban` | DELETE | `/v1/moderation/bans/:banId` | yes | user_ban:revoke | unverified |
| `moderation.kick` | POST | `/v1/stations/:stationId/kick` | yes | user_kick | unverified |
| `events.list` | GET | `/v1/stations/:stationId/events` | yes | server_event:read | unverified |
| `matches.list` | GET | `/v1/stations/:stationId/matches` | yes | station:read | unverified |
| `matches.get` | GET | `/v1/matches/:matchId` | yes | station:read | unverified |

## auth

### Who am I — `auth.whoami`

Returns the identity/owner associated with the authenticated API key.

- **Method / Path:** `GET /v1/me`
- **Auth required:** yes
- **Permission scope:** none
- **Status:** unverified
- **Example response:**

  ```json
  {
    "id": "usr_123",
    "name": "ExampleOwner",
    "platform": "meta"
  }
  ```
- **Status codes:** `200` OK, `401` Invalid or expired key
- **Notes:** Placeholder — not confirmed against a live server. Replace with a verified definition captured from the official dashboard.

## permissions

### Permission summary — `permissions.summary`

Lists the scopes, fleets, and stations the authenticated key can access.

- **Method / Path:** `GET /v1/permissions`
- **Auth required:** yes
- **Permission scope:** none
- **Status:** unverified
- **Example response:**

  ```json
  {
    "permissions": {
      "Strike Tournament": [
        "admin",
        "fleet:join",
        "user_kick"
      ],
      "Strike": [
        "fleet:join",
        "fleet:read",
        "station_config:read",
        "station_config:write"
      ]
    }
  }
  ```
- **Status codes:** `200` OK, `401` Unauthorized, `403` Forbidden
- **Notes:** Placeholder — not confirmed against a live server. Replace with a verified definition captured from the official dashboard.

## fleet

### List fleets — `fleet.list`

All fleets accessible to the authenticated key.

- **Method / Path:** `GET /v1/fleets`
- **Auth required:** yes
- **Permission scope:** fleet:read
- **Status:** unverified
- **Example response:**

  ```json
  [
    {
      "id": "flt_1",
      "name": "Alpha Fleet",
      "region": "us-east",
      "stationCount": 3
    }
  ]
  ```
- **Status codes:** `200` OK, `401` Unauthorized
- **Notes:** Placeholder — not confirmed against a live server. Replace with a verified definition captured from the official dashboard.

### Get fleet — `fleet.get`

Details for a single fleet.

- **Method / Path:** `GET /v1/fleets/:fleetId`
- **Auth required:** yes
- **Permission scope:** fleet:read
- **Status:** unverified
- **Fleet-scoped**
- **Parameters:**
  - `fleetId` (path) — required — e.g. `flt_1`
- **Notes:** Placeholder — not confirmed against a live server. Replace with a verified definition captured from the official dashboard.

## station

### List stations — `station.list`

Stations belonging to a fleet.

- **Method / Path:** `GET /v1/fleets/:fleetId/stations`
- **Auth required:** yes
- **Permission scope:** station:read
- **Status:** unverified
- **Fleet-scoped**
- **Parameters:**
  - `fleetId` (path) — required — e.g. `flt_1`
- **Example response:**

  ```json
  [
    {
      "id": "stn_1",
      "name": "Station One",
      "status": "online",
      "playerCount": 4,
      "version": "1.2.3"
    }
  ]
  ```
- **Notes:** Placeholder — not confirmed against a live server. Replace with a verified definition captured from the official dashboard.

### Get station — `station.get`

Full detail + live status for a single station.

- **Method / Path:** `GET /v1/stations/:stationId`
- **Auth required:** yes
- **Permission scope:** station:read
- **Status:** unverified
- **Station-scoped**
- **Parameters:**
  - `stationId` (path) — required — e.g. `stn_1`
- **Notes:** Placeholder — not confirmed against a live server. Replace with a verified definition captured from the official dashboard.

### Update station config — `station.updateConfig`

Writes the full/partial config object for a station.

- **Method / Path:** `PATCH /v1/stations/:stationId/config`
- **Auth required:** yes
- **Permission scope:** station_config:write
- **Status:** unverified
- **Station-scoped**
- **Parameters:**
  - `stationId` (path) — required — e.g. `stn_1`
- **Example request body:**

  ```json
  {
    "config": {
      "maxPlayers": 8
    }
  }
  ```
- **Status codes:** `200` Saved, `403` Missing write permission, `422` Invalid config
- **Notes:** Placeholder — not confirmed against a live server. Replace with a verified definition captured from the official dashboard.

## board

### Get board textures — `board.get`

Current BoardTextureUrl values for every board slot on a station.

- **Method / Path:** `GET /v1/stations/:stationId/boards`
- **Auth required:** yes
- **Permission scope:** station_config:read
- **Status:** unverified
- **Station-scoped**
- **Parameters:**
  - `stationId` (path) — required — e.g. `stn_1`
- **Example response:**

  ```json
  {
    "slots": [
      {
        "key": "BoardTextureUrl0",
        "name": "Board 0",
        "textureUrl": "https://…/a.png"
      }
    ]
  }
  ```
- **Notes:** Placeholder — not confirmed against a live server. Replace with a verified definition captured from the official dashboard.

### Set board texture — `board.set`

Sets the texture URL for one board slot.

- **Method / Path:** `PUT /v1/stations/:stationId/boards/:slotKey`
- **Auth required:** yes
- **Permission scope:** custom_config:write
- **Status:** unverified
- **Station-scoped**
- **Parameters:**
  - `stationId` (path) — required — e.g. `stn_1`
  - `slotKey` (path) — required — e.g. `BoardTextureUrl0`
- **Example request body:**

  ```json
  {
    "textureUrl": "https://…/new.png"
  }
  ```
- **Notes:** Placeholder — not confirmed against a live server. Replace with a verified definition captured from the official dashboard.

## gamemode

### List gamemodes — `gamemode.list`

Loaded gamemodes with arena keys and override parameters.

- **Method / Path:** `GET /v1/stations/:stationId/gamemodes`
- **Auth required:** yes
- **Permission scope:** station_config:read
- **Status:** unverified
- **Station-scoped**
- **Parameters:**
  - `stationId` (path) — required — e.g. `stn_1`
- **Notes:** Placeholder — not confirmed against a live server. Replace with a verified definition captured from the official dashboard.

### Set gamemode overrides — `gamemode.setOverrides`

Writes override parameter values for a gamemode.

- **Method / Path:** `PUT /v1/stations/:stationId/gamemodes/:gamemodeKey`
- **Auth required:** yes
- **Permission scope:** station_config:write
- **Status:** unverified
- **Station-scoped**
- **Parameters:**
  - `stationId` (path) — required — e.g. `stn_1`
  - `gamemodeKey` (path) — required — e.g. `deathmatch`
- **Example request body:**

  ```json
  {
    "overrides": {
      "scoreLimit": 25
    }
  }
  ```
- **Notes:** Placeholder — not confirmed against a live server. Replace with a verified definition captured from the official dashboard.

## player

### Search players — `player.search`

Search players by name or id.

- **Method / Path:** `GET /v1/players`
- **Auth required:** yes
- **Permission scope:** user_data:read
- **Status:** unverified
- **Parameters:**
  - `q` (query) — e.g. `nova`
- **Notes:** Placeholder — not confirmed against a live server. Replace with a verified definition captured from the official dashboard.

### Get player — `player.get`

A single player profile with roles and ban state.

- **Method / Path:** `GET /v1/players/:playerId`
- **Auth required:** yes
- **Permission scope:** user_data:read
- **Status:** unverified
- **Parameters:**
  - `playerId` (path) — required — e.g. `ply_1`
- **Notes:** Placeholder — not confirmed against a live server. Replace with a verified definition captured from the official dashboard.

## roles

### List roles — `roles.list`

All assignable roles.

- **Method / Path:** `GET /v1/roles`
- **Auth required:** yes
- **Permission scope:** role:read
- **Status:** unverified
- **Notes:** Placeholder — not confirmed against a live server. Replace with a verified definition captured from the official dashboard.

### Assign role — `roles.assign`

Assigns a role to a player.

- **Method / Path:** `POST /v1/players/:playerId/roles`
- **Auth required:** yes
- **Permission scope:** role:write
- **Status:** unverified
- **Parameters:**
  - `playerId` (path) — required — e.g. `ply_1`
- **Example request body:**

  ```json
  {
    "roleId": "rol_mod"
  }
  ```
- **Notes:** Placeholder — not confirmed against a live server. Replace with a verified definition captured from the official dashboard.

## moderation

### Ban player — `moderation.ban`

Bans a player from a fleet/station.

- **Method / Path:** `POST /v1/moderation/bans`
- **Auth required:** yes
- **Permission scope:** user_ban:write
- **Status:** unverified
- **Example request body:**

  ```json
  {
    "playerId": "ply_1",
    "reason": "cheating",
    "durationHours": 24
  }
  ```
- **Notes:** Placeholder — not confirmed against a live server. Replace with a verified definition captured from the official dashboard.

### Unban player — `moderation.unban`

Removes a ban.

- **Method / Path:** `DELETE /v1/moderation/bans/:banId`
- **Auth required:** yes
- **Permission scope:** user_ban:revoke
- **Status:** unverified
- **Parameters:**
  - `banId` (path) — required — e.g. `ban_1`
- **Notes:** Placeholder — not confirmed against a live server. Replace with a verified definition captured from the official dashboard.

### Kick player — `moderation.kick`

Kicks a player from their current session.

- **Method / Path:** `POST /v1/stations/:stationId/kick`
- **Auth required:** yes
- **Permission scope:** user_kick
- **Status:** unverified
- **Station-scoped**
- **Parameters:**
  - `stationId` (path) — required — e.g. `stn_1`
- **Example request body:**

  ```json
  {
    "playerId": "ply_1"
  }
  ```
- **Notes:** Placeholder — not confirmed against a live server. Replace with a verified definition captured from the official dashboard.

## server-events

### List server events — `events.list`

Recent server events for a station (polled).

- **Method / Path:** `GET /v1/stations/:stationId/events`
- **Auth required:** yes
- **Permission scope:** server_event:read
- **Status:** unverified
- **Station-scoped**
- **Parameters:**
  - `stationId` (path) — required — e.g. `stn_1`
  - `since` (query) — e.g. `0`
- **Notes:** Placeholder — not confirmed against a live server. Replace with a verified definition captured from the official dashboard.

## match-history

### List matches — `matches.list`

Match history for a station.

- **Method / Path:** `GET /v1/stations/:stationId/matches`
- **Auth required:** yes
- **Permission scope:** station:read
- **Status:** unverified
- **Station-scoped**
- **Parameters:**
  - `stationId` (path) — required — e.g. `stn_1`
- **Notes:** Placeholder — not confirmed against a live server. Replace with a verified definition captured from the official dashboard.

### Get match — `matches.get`

Full detail for a single match, including player stats.

- **Method / Path:** `GET /v1/matches/:matchId`
- **Auth required:** yes
- **Permission scope:** station:read
- **Status:** unverified
- **Parameters:**
  - `matchId` (path) — required — e.g. `mtc_1`
- **Notes:** Placeholder — not confirmed against a live server. Replace with a verified definition captured from the official dashboard.
