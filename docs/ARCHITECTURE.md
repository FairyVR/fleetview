# Architecture

FleetView is an Electron app split into a **main process** (privileged: secrets + network)
and a **renderer** (the React UI). They never share a raw API key.

```
┌──────────────────────────── Renderer (React) ────────────────────────────┐
│ Presentation   presentation/pages, presentation/components                │
│      ↓                                                                     │
│ Services       services/useEndpoint, state/*  (zustand)                   │
│      ↓                                                                     │
│           window.api  (preload contextBridge, typed by @shared/ipc)       │
└───────────────────────────────────┼───────────────────────────────────────┘
                                     │ IPC (ipcRenderer.invoke)
┌───────────────────────────────────┼───────────────────────────────────────┐
│ API Client     main/api-client   (registry-driven fetch: retry, timeout,  │
│      ↓                             rate-limit, permission pre-check, logs) │
│ Authentication main/secure-storage (safeStorage vault), main/key-service  │
│      ↓                                                                     │
│ Models         @shared/models, @shared/registry  (shared by both sides)   │
└───────────────────────────────────────────────────────────────────────────┘
```

## Layer responsibilities

| Layer | Location | Responsibility |
| --- | --- | --- |
| Presentation | `src/renderer/src/presentation` | Pages + reusable components. No direct `fetch`. |
| Services | `src/renderer/src/services`, `state` | `useEndpoint` hook, zustand stores, view logic. |
| API Client | `src/main/api-client.ts` | Executes registry endpoints; retry/timeout/rate-limit; records logs. |
| Authentication | `src/main/secure-storage.ts`, `key-service.ts` | Encrypted key vault; test + permission discovery. |
| Models | `src/shared/models`, `src/shared/registry` | Types, zod-free schemas, the endpoint registry. |

## Why HTTP runs in the main process

The renderer is untrusted-ish (it renders remote data). Keeping the key and all `fetch` calls
in the main process means:

- The plaintext key never enters the renderer's memory or DevTools.
- Log entries are sanitized (`Authorization` → `Bearer ***`) before crossing IPC.
- CORS is a non-issue (main-process fetch isn't subject to it).

## The registry is the extension point

`src/shared/registry/endpoints.ts` is the single source of truth for every URL/method. Adding
an endpoint there makes it callable (`useEndpoint`), inspectable (Endpoint Explorer), loggable
(Dev Mode), and documented (`npm run gen:docs`) with no other code changes. This is the
"future expansion" requirement realized as data, not codegen.

## Security posture

- Secrets encrypted with OS-native `safeStorage` (DPAPI / Keychain / libsecret).
- `contextIsolation: true`, `nodeIntegration: false`, strict CSP in `index.html`.
- External links open in the OS browser, never in-app.
- Malformed JSON is captured as `{ _raw: … }` rather than throwing.
- Permission pre-check refuses actions the discovered permission set forbids.
