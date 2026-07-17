# Capturing real Orion Drift endpoints

FleetView ships with a registry of **unverified placeholder** endpoints. This guide explains
how to replace them with real, verified definitions captured from the official dashboard —
which is the intended path since no endpoint here has been confirmed against a live server.

> Only do this with an account and API key you are authorized to use. Capture traffic from
> your own authenticated session.

## 1. Capture the traffic

While signed into the official dashboard with an authorized account:

1. Open your browser DevTools → **Network** tab.
2. Filter to **Fetch/XHR**.
3. Exercise the feature you want to map (open a fleet, edit a board, etc.).
4. For each authenticated request, record:
   - Request URL and HTTP method
   - Required headers (esp. the `Authorization` scheme)
   - Request body (if any)
   - Response body and status code

Right-click a request → **Copy → Copy as cURL** captures most of this at once.

## 2. Add it to the registry

Open [`src/shared/registry/endpoints.ts`](../src/shared/registry/endpoints.ts) and append an
entry. Split the full URL into the base (goes in **Settings → API base URL**) and the path.

```ts
{
  id: 'fleet.list',                 // stable, dot-namespaced
  name: 'List fleets',
  description: 'All fleets accessible to the authenticated key.',
  category: 'fleet',
  method: 'GET',
  path: '/v1/fleets',               // path only — base URL comes from Settings
  requiresAuth: true,
  permission: 'read',               // maps to the UI permission gate
  responseExample: [ /* paste a trimmed real response */ ],
  statusCodes: { 200: 'OK', 401: 'Unauthorized' },
  status: 'verified'                // <-- mark verified, drop the placeholder note
}
```

Use `:token` in the path for path params and declare them in `params` (`in: 'path'`).
Declare query params with `in: 'query'`.

## 3. That's it

Everything else updates automatically:

- **Endpoint Explorer** lists and tests it.
- **Dev Mode** logs every call to it.
- Any page using `useEndpoint('<id>')` can call it.
- `npm run gen:docs` regenerates [`ENDPOINTS.md`](ENDPOINTS.md).

## Where verification happens

The app never hardcodes a URL outside the registry. The base URL is set once in Settings and
combined with each endpoint's `path` by `buildUrl()` in
[`src/shared/registry/index.ts`](../src/shared/registry/index.ts). Set `status: 'verified'`
only after a successful live **Test** in the Endpoint Explorer.
