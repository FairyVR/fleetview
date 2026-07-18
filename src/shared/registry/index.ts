import type { EndpointDef, ModuleCategory } from './types'
import { endpoints } from './endpoints'

export * from './types'
export { endpoints }

const byId = new Map(endpoints.map((e) => [e.id, e]))

export function getEndpoint(id: string): EndpointDef | undefined {
  return byId.get(id)
}

export function endpointsByCategory(category: ModuleCategory): EndpointDef[] {
  return endpoints.filter((e) => e.category === category)
}

/** Free-text search across id, name, description, path, and category. */
export function searchEndpoints(query: string): EndpointDef[] {
  const q = query.trim().toLowerCase()
  if (!q) return endpoints
  return endpoints.filter((e) =>
    [e.id, e.name, e.description, e.path, e.category, e.method].some((f) =>
      f.toLowerCase().includes(q)
    )
  )
}

export interface BuiltUrl {
  path: string
  missing: string[]
}

/**
 * Strip trailing slashes AND a trailing version segment from a stored base URL.
 * Every registry path carries its own /vN prefix, so a base ending in /vN would
 * double it (…/v2/v2/fleets → 404). Persisted settings can hold stale values.
 */
export function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '').replace(/\/v\d+$/, '')
}

/**
 * Resolve an endpoint's path template against provided params.
 * Path `:tokens` are substituted; declared query params are appended.
 * Returns the path plus any required params that were missing (never throws).
 */
export function buildUrl(
  endpoint: EndpointDef,
  params: Record<string, string | number | boolean> = {}
): BuiltUrl {
  const missing: string[] = []
  let path = endpoint.path

  for (const p of endpoint.params ?? []) {
    const value = params[p.name]
    if (p.in === 'path') {
      if (value === undefined || value === '') {
        if (p.required) missing.push(p.name)
        continue
      }
      path = path.replace(`:${p.name}`, encodeURIComponent(String(value)))
    }
  }

  const query = new URLSearchParams()
  for (const p of endpoint.params ?? []) {
    if (p.in !== 'query') continue
    const value = params[p.name]
    if (value === undefined || value === '') {
      if (p.required) missing.push(p.name)
      continue
    }
    query.set(p.name, String(value))
  }

  // Catch any leftover unsubstituted required path tokens.
  const leftover = path.match(/:([A-Za-z0-9_]+)/g)
  if (leftover) for (const t of leftover) missing.push(t.slice(1))

  const qs = query.toString()
  return { path: qs ? `${path}?${qs}` : path, missing }
}
