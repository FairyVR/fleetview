# FleetView — repo conventions

Desktop app (Electron + electron-vite + React 19 + TS + Tailwind v4) to manage Orion Drift
fleets/stations through a **data-driven endpoint registry**.

## Ground rules
- **Never hardcode an API URL outside the registry.** Add endpoints to
  `src/shared/registry/endpoints.ts`. Base URL lives in Settings only.
- Placeholder endpoints are `status: 'unverified'`. Only mark `verified` after a live test.
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
- Docs: `docs/ARCHITECTURE.md`, `docs/API-DISCOVERY.md`, `docs/ENDPOINTS.md` (generated).
