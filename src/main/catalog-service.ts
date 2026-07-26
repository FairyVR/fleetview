import {
  CATALOG_URL,
  CATALOG_MAX_BYTES,
  parseCatalog,
  type CatalogState
} from '@shared/catalog'
import { catalogStore } from './stores'

/** Serve the cache without hitting the network for this long after a successful fetch. */
const CACHE_TTL_MS = 6 * 60 * 60 * 1000
const FETCH_TIMEOUT_MS = 15_000

function cached(error?: string): CatalogState {
  return {
    catalog: catalogStore.get('catalog'),
    fetchedAt: catalogStore.get('fetchedAt'),
    ...(error ? { error } : {})
  }
}

/**
 * Read the community catalog, from cache unless it is stale or `force` is set.
 *
 * The response is untrusted remote input, so it is size-capped and shape-checked before it is
 * stored. A bad or unreachable response never clobbers a good cache — the caller gets the stale
 * catalog plus an error to show, which keeps the page usable offline.
 */
export async function fetchCatalog(force = false): Promise<CatalogState> {
  const fetchedAt = catalogStore.get('fetchedAt')
  const have = catalogStore.get('catalog')
  if (!force && have && Date.now() - fetchedAt < CACHE_TTL_MS) return cached()

  const etag = catalogStore.get('etag')
  try {
    const res = await fetch(CATALOG_URL, {
      headers: {
        Accept: 'application/json',
        ...(etag && have ? { 'If-None-Match': etag } : {})
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
    })

    if (res.status === 304 && have) {
      catalogStore.set('fetchedAt', Date.now())
      return cached()
    }
    if (!res.ok) return cached(`Catalog fetch failed (HTTP ${res.status}).`)

    const declared = Number(res.headers.get('content-length'))
    if (Number.isFinite(declared) && declared > CATALOG_MAX_BYTES) {
      return cached('Catalog is too large to load.')
    }

    const text = await res.text()
    if (text.length > CATALOG_MAX_BYTES) return cached('Catalog is too large to load.')

    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      return cached('Catalog is not valid JSON.')
    }

    const catalog = parseCatalog(parsed)
    if (!catalog) return cached('Catalog format was not recognized.')

    catalogStore.set('catalog', catalog)
    catalogStore.set('fetchedAt', Date.now())
    catalogStore.set('etag', res.headers.get('etag'))
    return cached()
  } catch (err) {
    const offline = err instanceof Error && err.name === 'TimeoutError'
    return cached(offline ? 'Catalog request timed out.' : 'Could not reach the catalog.')
  }
}
