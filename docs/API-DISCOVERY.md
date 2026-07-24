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

## Config writes (2026-07-19, verified from a working client)

`POST /v2/stations/{station_id}/config?include_fleet_config=true&include_event_config=false`
accepts ONLY this shape — anything else returns **422**:

- a **flat dotted-key map** at the body root — no `{"config": {...}}` wrapper;
- **every value a string** (`"true"`, `"301"`), never native booleans/numbers;
- **only the changed keys** (partial update), not the full config blob.

Verified against the StrikeTournamentTool Discord bot, which writes this endpoint in
production. FleetView centralizes the shape in `configDiff()`/`CONFIG_WRITE_PARAMS`
(`src/renderer/src/lib/stationConfig.ts`).

**Deleting keys** (2026-07-23, schema live-verified by 422 probing):
`DELETE /v2/stations/{station_id}/config` REQUIRES a body — a JSON array of dotted
config key names to delete (`["config.spawnPointSettings.overrideSpawnPoint"]`).
No body / wrong type → 422. There is no bodiless "reset all"; a full reset sends
every current override key. Per-key delete is how editor key-removals are saved.

## Structural gotchas

- **Stations come from the fleet list** (`GET /v2/fleets?include_stations=true` →
  `items[].stations[]`), `GET /v2/fleets/{fleet_id}/stations`, or the fleet detail
  `GET /v1/fleets/{fleet_id}` — live-verified 2026-07-22 via the logged-in dashboard. The v1
  detail response is FLAT at the root (`fleet_id`, `fleet_name`, `stations[]`, `config{}` — no
  `fleet` wrapper) and its stations include `ip`, `disabled`, and `last_event`, which the v2
  lists omit. (`/v2/fleets/{id}` still 404s.)
- **Board textures and gamemode overrides are not endpoints.** They are keys inside the
  station config object (`BoardTextureUrl0`, …) read/written via
  `GET|POST /v2/stations/{station_id}/config`.
- **Kick exists in the product but its endpoint is uncaptured.** The dashboard's Players page
  says admins can "kick players", and the `user_kick` scope is real (assigned to live roles) —
  but no kick route was found in the client bundle or observed on the wire (2026-07-22 walk;
  the SvelteKit server does most API calls server-side, invisible to the browser). Probe before
  building UI. There is still **no match-history endpoint** — the dashboard's Match History
  page renders `gamemode_stopped` server events, same as FleetView.
- **Role assignment: use `POST /v2/fleets/{fleet_id}/user_roles`** (body
  `{ username, role_id, expires_hours }`, scope `user_roles:write`; `expires_hours` is
  **required and must be an integer** — omitting it 422s "Field required", `null` 422s
  "Input should be a valid integer". We send `0` for "no expiry"; NOTE enforcement looks
  absent anyway — a 1-hour grant was observed to NOT auto-remove the role).
  Live-verified 2026-07-23: it takes a
  **username** (no user-id resolution needed) and assigns the role even to a user who has
  **never played in the fleet**, which the old
  `POST /v1/fleets/{fleet_id}/users/{user_id}/roles/{role_id}` route refused. Default to it.
  Responds `{ success, user_exists }` — a garbage username still returns HTTP 200 with
  `user_exists: false`, so check that flag, not the status code. (Unassign still uses the
  v1 `DELETE .../role/{role_id}` route.)
- Field names are `snake_case`: `fleet_id`, `fleet_name`, `station_id`, `station_name`,
  `role_id`, `role_name`, `permissions[]`, `user_id`, `ban_id`.
- Versions are mixed per route (`/v1`, `/v2`, `/v3`) — copy them exactly.
- Use `fleet_id: "global"` for global roles.

## Semantics learned from the logged-in dashboard (2026-07-22 walk)

A full walk of `dashboard.oriondrift.net` (v0.8.4) while signed in documented what the raw
config keys and payloads *mean*:

- **Fleet config known keys** (fleet-level, written via `POST /v1/fleets/{id}/config`):
  `is_public` (off = "unlisted" — stations only findable by exact-name search in game),
  `is_whitelist` (allowlist-only; players need `fleet:join`), `primary_color` /
  `secondary_color` (hex), fleet description + logo URL fields,
  `config.gateKeeperVolumes.*` (VIP space locks: Circuit Lounge, Driftplex, Fieldhouse,
  Dave's Office — office entry requires the `key_holder_office` permission),
  `config.spawnPointSettings.*` (spawn override), `CustomGamemodes.<Name>`
  (packed string: `1;c;g;<GUID>;;<version-or-tag>`).
- **Reports shape** (per-player views on the dashboard): `report_id`, reported player
  (id + name), `reported_by` (id + name), `reason` (categories seen: Cheating, Verbal Abuse,
  Hate Speech, Exploiting, Breaking Community Rules), free-text `comments` (editable after
  filing), `created_at`, `last_updated`.
- **Scheduled fleet events** have create/modify UI (title, description, start time, duration,
  recurring) — so writes exist beyond the read-only `GET /v2/fleets/{id}/events` in the
  registry; routes uncaptured (SSR).
- **Match History** is station-scoped and renders per-player telemetry from
  `gamemode_stopped` events: OS version, device type, client FPS, MI, packet loss in/out,
  bandwidth in/out, jitter, per-player duration, plus server frame stats, scores, and
  "Reason for Stop" (e.g. `team1 match win` — the winner is named here, not per-player).
- **Account page** (`/account`) shows API key self-service (create/revoke, expiry), active
  session keys, and the account's **explicit per-fleet permission grants** — so an
  authoritative "my permissions" source exists server-side (route uncaptured, SSR).

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
