# FleetView — repo conventions

Desktop app (Electron + electron-vite + React 19 + TS + Tailwind v4) to manage Orion Drift
fleets/stations through a **data-driven endpoint registry**.

## The real API (do not re-derive)
- Base URL `https://api.oriondrift.net`; auth header **`x-api-key`** (NOT Bearer).
- Keys are JWTs (three dot-separated segments).
- Permissions are granted **per fleet**; `admin` on a fleet = all scopes for that fleet.
  Scope names are real strings like `fleet:read`, `station_config:write`, `user_ban:revoke`.
- No `/me`, no kick, no match-history endpoint. Stations come from
  `GET /v2/fleets?include_stations=true` → `items[].stations[]` or
  `GET /v2/fleets/:fleetId/stations` (the v1 fleet-detail route is unverified — `/v2/fleets/:id`
  404s). Board textures + gamemode overrides are keys inside
  `GET|POST /v2/stations/:stationId/config`.
- Keys are **Service Keys**: no scope lists ever come back, so discovery probes cheap reads
  per fleet and stores grants with `source: 'probed'` — advisory only, never pre-flight denied.
- Field names are snake_case (`fleet_id`, `station_name`, `role_id`, `user_id`).
- Full details + how it was discovered: `docs/API-DISCOVERY.md`.

## Ground rules
- **Never hardcode an API URL outside the registry.** Add endpoints to
  `src/shared/registry/endpoints.ts`. Base URL lives in Settings only.
- Only mark an endpoint `verified` once its path/method/auth is confirmed.
- **Never deny an action on unknown permissions.** A failed permission lookup must stay
  *unknown* and let the server decide — persisting an empty "discovered" set caused a bug
  that falsely blocked every action.
- The renderer must never touch a raw API key. All HTTP + secrets stay in the main process;
  the renderer calls `window.api.*` (typed by `@shared/ipc`).

## Layout
- `src/shared` — models + registry (imported by both main and renderer).
- `src/main` — main process: `api-client`, `secure-storage`, `key-service`, `library-service`, `ipc`.
- `src/preload` — contextBridge exposing `window.api`.
- `src/renderer/src` — `presentation/` (pages, components), `services/` (`useEndpoint`), `state/` (zustand), `lib/`.

## Patterns
- New API-backed page: `useEndpoint('<id>', { params, auto })` + `<RequestResult>`. Mirror
  `presentation/pages/FleetPage.tsx`.
- Station-scoped page: wrap in `<StationScoped>`. Gate writes with `<PermissionGate scope="…">`.
- Responses have unknown shape — coerce defensively (`Array.isArray(...) ? ... : (data as any)?.x`).

## Commands
- `npm run dev` · `npm run typecheck` (node + web) · `npm test` · `npm run gen:docs`
- Single test file: `npx vitest run tests/presence.test.ts` (all tests live in `tests/`).
- Docs: `docs/ARCHITECTURE.md`, `docs/API-DISCOVERY.md`, `docs/ENDPOINTS.md` (generated).

## Distribution
- `npm run dist` → NSIS installer in `release/` (unsigned — admins click through SmartScreen).
- Ship via GitHub Releases on `FairyVR/fleetview` (private repo — admins must be collaborators):
  `gh release create vX.Y.Z "release\FleetView Setup X.Y.Z.exe"`.
- If electron-builder fails with "Cannot create symbolic link" unpacking winCodeSign: extract
  the cached .7z manually with `7za x -xr!*.dylib` into
  `%LOCALAPPDATA%\electron-builder\Cache\winCodeSign\winCodeSign-2.6.0` (mac symlinks need
  admin rights on Windows; excluding them is safe). Already done on this machine.
