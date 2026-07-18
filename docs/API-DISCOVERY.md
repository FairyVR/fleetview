# Orion Drift API — discovered contract

This documents the real API FleetView talks to, and how it was determined.

## The essentials

| | |
| --- | --- |
| **Base URL** | `https://api.oriondrift.net` |
| **Auth header** | `x-api-key: <your key>` |
| **Key format** | A **JWT** — three dot-separated segments (`xxx.yyy.zzz`) |
| **Dashboard** | `https://dashboard.oriondrift.net` (account page: `/account`) |
| **Anonymous call** | `403 {"detail":"Not authenticated"}` |
| **Bad key** | `401 {"error_name":"Couldn't decode API key", ...}` |

> It is **not** `Authorization: Bearer`. Using Bearer will fail even with a valid key.

## How this was determined

The dashboard is a SvelteKit app whose client bundles are public. No credentials or session
data were used — only the publicly served JavaScript, plus unauthenticated probes.

1. Fetched `https://dashboard.oriondrift.net/` and followed its `_app/immutable/entry/*.js`
   imports to download all ~106 chunks.
2. The config chunk contains the host verbatim:
   ```js
   const n="3783906545031149", t="prod", s="https://api.oriondrift.net";
   ```
3. The API client wrapper reveals the auth scheme (an `openapi-fetch` client):
   ```js
   z({ baseUrl: I, headers: { "x-api-key": r.apiKey } })
   ```
4. Every endpoint appears as a typed call, e.g.
   `Ne.GET("/v1/fleets/{fleet_id}/roles", { params:{ path:{ fleet_id } } })`.
   Extracting all `.GET|POST|PUT|PATCH|DELETE("/…")` literals produced the endpoint list.
5. Confirmed live with unauthenticated + invalid-key probes (see the table above), which
   proved the host, the route, and that the server reads `x-api-key`.

There is **no public OpenAPI schema** (`/openapi.json`, `/docs`, `/swagger.json` all 404).

## Permission model

Permissions are granted **per fleet**, not per account. Each fleet maps to a list of scope
strings; **`admin` within a fleet grants every permission for that fleet**.

Real scopes observed in the dashboard:

```
admin                    fleet:join               fleet:read               fleet:write
fleet_config:read        fleet_config:write       fleet_report:read        fleet_report:write
station:read             station:write            station:create           station:delete
station_config:read      station_config:write     custom_config:write      config_netvars:write
user_data:read           user_kick                user_permissions:read
user_roles:read          user_roles:write         user_ban:write           user_ban:revoke
user_ban:update          user_ban_short:write     user:create              user:delete
role:read                role:write               record_entry:write
server_event:read        server_event:write       station:key:create
global:fleet:create      global:fleet:delete      global:key:create        global:key:delete
global:user_data         self:key:create          self:fleet_report:read   self:fleet_report:write
```

Cosmetic/non-API flags also appear on accounts (`key_holder*`, `global_voip`,
`anonymous_mode`, `color:*`) — these are not API scopes.

**Rule:** never treat a failed permission lookup as "no permissions." There is no
"my permissions" endpoint, so FleetView leaves permissions *unknown* and lets the server be
the authority rather than falsely blocking actions.

## Live probing with a Service Key (2026-07-18)

A real key (a **Service Key** — server administration/telemetry, not a user profile;
`/v2/users/me` → 401) was used to probe the API directly. Confirmed working on `v2`:

| Endpoint | Notes |
| --- | --- |
| `GET /v2/fleets?include_config&include_stations&include_offline_fleets&page&page_size` | The exact request the dashboard makes — one call returns fleets **with embedded stations and config**. FleetView's key test + permission discovery use it. |
| `GET /v2/stations` | Global paginated telemetry: every active server, per-zone player counts, IPs/ports. |
| `GET /v2/fleets/{fleet_id}/stations` | Paginated stations for one fleet. |
| `GET /v2/stations/{station_id}` | Region, live player count, session ids. |
| `GET\|POST /v2/stations/{station_id}/config` | Whitelists, gamemode settings, spawn overrides, `BoardTextureUrl*`, netcode flags. |
| `GET /v2/stations/{station_id}/server_events` | Match feed; `gamemode_stopped` carries score/duration/winner/players. |
| `GET /v2/users/{user_id}` | Global profile: username, created, last login, banned. |
| `GET /v2/fleets/{fleet_id}/bans` | Active bans for the fleet. |

**404 on `v2`** (no public equivalent; the v1/v3 paths from the dashboard bundle are kept in
the registry as `unverified`): `/fleets/{fleet_id}` (root fleet info),
`/fleets/{fleet_id}/players`, `/fleets/{fleet_id}/roles`,
`/stations/{station_id}/match_history` (the dashboard aggregates `server_events` instead).

Two more live findings (2026-07-18, verified with a real Service Key):

- **Missing scopes come back as `401`, not 403**, with
  `{"error_name":"Invalid Permissions","detail":"You need the <scope> permission on fleet <id> …"}`
  — the body names the exact missing scope. The API client maps this to `permission-denied`
  (a plain 401 without that error_name still means bad/expired key).
- **The fleet list shows more fleets than the key can use.** It returns every *visible*
  fleet (16 for the test key); per-fleet reads succeeded on only 2 of them. Listing ≠ access,
  which is why probing is per fleet.
- Bans use `timestamp`/`expiration` (ISO strings, `expiration: null` = permanent);
  server events wrap `event_data` as a JSON string with an ISO `timestamp`.

Service Keys get **no scope lists back** from any endpoint. Discovery therefore records the
fleets the list returns and *probes* two cheap reads per fleet (stations, bans); the result
is stored with `source: 'probed'` and is **advisory only** — probes can't see write scopes,
so a probed set never pre-flight denies anything (`source: 'explicit'` sets still can).

## Structural gotchas

- **Stations come from the fleet list** (`GET /v2/fleets?include_stations=true` →
  `items[].stations[]`) or `GET /v2/fleets/{fleet_id}/stations`. The v1 fleet-detail route is
  unconfirmed (`/v2/fleets/{id}` 404s).
- **Board textures and gamemode overrides are not endpoints.** They are keys inside the
  station config object (`BoardTextureUrl0`, …) read/written via
  `GET|POST /v2/stations/{station_id}/config`.
- **There is no kick endpoint** and **no match-history endpoint** in the dashboard API.
- Field names are `snake_case`: `fleet_id`, `fleet_name`, `station_id`, `station_name`,
  `role_id`, `role_name`, `permissions[]`, `user_id`, `ban_id`.
- Versions are mixed per route (`/v1`, `/v2`, `/v3`) — copy them exactly.
- Use `fleet_id: "global"` for global roles.

## Adding an endpoint

Append one object to [`src/shared/registry/endpoints.ts`](../src/shared/registry/endpoints.ts):

```ts
{
  id: 'fleet.list',
  name: 'List fleets',
  description: 'All fleets the authenticated key can access.',
  category: 'fleet',
  method: 'GET',
  path: '/v2/fleets',        // path only — base URL comes from Settings
  requiresAuth: true,
  permission: 'fleet:read',  // real scope name; gates the UI
  status: 'verified'
}
```

Path params use `:token` (declare each in `params` with `in: 'path'`). The token name is
internal — it only has to match the key you pass from a page.

Everything else updates automatically: the Endpoint Explorer lists and tests it, Dev Mode
logs it, `useEndpoint('<id>')` can call it, and `npm run gen:docs` regenerates
[`ENDPOINTS.md`](ENDPOINTS.md).
