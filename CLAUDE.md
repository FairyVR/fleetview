# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
- `station.config.set` takes a **flat dotted-key map**, all values as strings, only changed keys.
  Wrapped/typed/full-blob bodies 422. `station.config.delete` takes a JSON **array** of key names.
- Keys are **Service Keys**: no scope lists ever come back, so discovery probes cheap reads
  per fleet and stores grants with `source: 'probed'` — advisory only, never pre-flight denied.
- Field names are snake_case (`fleet_id`, `station_name`, `role_id`, `user_id`).
- Full details + how it was discovered: `docs/API-DISCOVERY.md`.

## Ground rules
- **Never hardcode an API URL outside the registry.** Add endpoints to
  `src/shared/registry/endpoints.ts`. Base URL lives in Settings only. (The community catalog
  in `src/shared/catalog.ts` is a different service, not the Orion Drift API — its URL is a
  single named export there.)
- Only mark an endpoint `verified` once its path/method/auth is confirmed.
- **Never deny an action on unknown permissions.** A failed permission lookup must stay
  *unknown* and let the server decide — persisting an empty "discovered" set caused a bug
  that falsely blocked every action.
- The renderer must never touch a raw API key. All HTTP + secrets stay in the main process;
  the renderer calls `window.api.*` (typed by `@shared/ipc`).
- Validate untrusted input at the main-process boundary (see `assertValidBaseUrl` /
  `sanitizeSettingsPatch` in `src/main/ipc.ts`, `parseCatalog` in `src/shared/catalog.ts`).
  Note `importBundle` predates this and does *no* shape checking.

## Layout
- `src/shared` — models, registry, `catalog.ts`, `ipc.ts` (imported by both main and renderer).
- `src/main` — main process: `api-client`, `secure-storage`, `key-service`, `library-service`,
  `catalog-service`, `stores` (electron-store instances), `ipc`.
- `src/preload` — contextBridge exposing `window.api`.
- `src/renderer/src` — `presentation/` (pages, components), `services/` (`useEndpoint`),
  `state/` (zustand), `lib/` (pure logic — this is where testable code goes).

## State & persistence
All persistence is **main-process `electron-store`** (`src/main/stores.ts`: settings, keys,
secrets, permissions, library, catalog cache), reached over IPC. The zustand stores in
`state/` are in-memory only — there is no `persist` middleware anywhere. Settings are loaded
into `useAppStore` at startup, so changing them via `api.setSettings` does not update the
renderer until `load()` runs or the window reloads.

Adding an IPC method touches four files: `CHANNELS` + `FleetViewApi` in `src/shared/ipc.ts`,
a handler in `src/main/ipc.ts`, and a one-liner in `src/preload/index.ts`.

## Patterns
- New API-backed page: `useEndpoint('<id>', { params, auto })` + `<RequestResult>`. Mirror
  `presentation/pages/FleetPage.tsx`.
- Adding a page = 3 edits: the file in `presentation/pages/`, a `<Route>` in `App.tsx`, an
  entry in `presentation/nav.ts`.
- Station-scoped page: wrap in `<StationScoped>`. Gate writes with `<PermissionGate scope="…">`.
- Responses have unknown shape — coerce defensively (`Array.isArray(...) ? ... : (data as any)?.x`).
  Pages define a local `asX(data: unknown): X[]` normalizer at module top.
- Service functions that build an object by enumerating fields explicitly (e.g. `saveLeConfig`)
  silently drop anything unlisted — add new model fields there too.

## UI conventions
- **CSS variables are the design system**, not Tailwind theme tokens. There is no
  `tailwind.config.js` and no `@theme` block — just `@import 'tailwindcss'` plus
  `:root[data-theme='…']` blocks in `index.css` for 6 themes.
- Always reference colors as arbitrary values: `text-[var(--text-dim)]`,
  `bg-[var(--bg-elev-2)]`. Never `text-gray-400`.
- Hand-written component classes live in `index.css`: `.card`, `.btn*`, `.input`, `.label`,
  `.chip`, `.mono`. Font sizes are arbitrary px (`text-[13px]`), not the Tailwind scale.
- The component kit (`presentation/components/`) is deliberately thin. There is **no** Table,
  Tabs, toast, dropdown, or confirm-dialog component — lists are card/div grids, and search
  inputs are an inline idiom rather than a component.
- Guard conditional JSX with real booleans (`!!c.tags?.length`) — a bare `.length` renders `0`.

## Commands
- `npm run dev` · `npm run typecheck` (node + web) · `npm test` · `npm run build` · `npm run gen:docs`
- Single test file: `npx vitest run tests/presence.test.ts`.
- **There is no lint step** (no eslint/prettier config); `typecheck` is the static gate.
- Docs: `docs/ARCHITECTURE.md`, `docs/API-DISCOVERY.md`, `docs/ENDPOINTS.md` (generated),
  `docs/CATALOG.md` (how to publish a community LE build).

## Testing
`vitest.config.ts` runs `tests/**/*.test.ts` with `environment: 'node'`. Tests are **pure-logic
only** — there are no component/render tests despite `@testing-library/react` and `jsdom` being
installed. The convention is to put parsing/normalizing/filtering logic in
`src/renderer/src/lib/*` (or a main-process service) and test that; `.tsx` stays untested.
Imports use deep relative paths; no fixtures, mocks, or setup file.

## Verifying UI changes by running the app
`npm run dev` for interactive work. To drive it programmatically, launch the built app with
CDP and an isolated profile so the real library/keys aren't touched:

```bash
npm run build
./node_modules/electron/dist/electron.exe . --remote-debugging-port=9222 --disable-gpu \
  --user-data-dir=<scratch>/appdata
```

Then talk to `http://127.0.0.1:9222/json` over a WebSocket (Node 24 has a global `WebSocket`,
so no Playwright needed) and use `Runtime.evaluate` / `Page.captureScreenshot`.

- **`--disable-gpu` is required**: with GPU compositing on, `Page.captureScreenshot` hangs
  forever on a backgrounded window, and Win32 `PrintWindow` returns a stale frame.
- Hash navigation to the route you're already on won't remount the page — bounce via another
  route to force a refresh.
- `navigator.clipboard` rejects when the window isn't focused.

## Distribution
- `npm run dist` → NSIS installer in `release/` (unsigned — admins click through SmartScreen).
- Ship via GitHub Releases on `FairyVR/fleetview` (public repo):
  `gh release create vX.Y.Z "release\FleetView Setup X.Y.Z.exe"`.
- If electron-builder fails with "Cannot create symbolic link" unpacking winCodeSign: extract
  the cached .7z manually with `7za x -xr!*.dylib` into
  `%LOCALAPPDATA%\electron-builder\Cache\winCodeSign\winCodeSign-2.6.0` (mac symlinks need
  admin rights on Windows; excluding them is safe). Already done on this machine.
