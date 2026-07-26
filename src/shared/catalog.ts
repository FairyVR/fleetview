/**
 * The community LE build catalog: a curated JSON file on the public FleetView repo.
 *
 * Authors DM their builds to the maintainer, who publishes them with the "Copy catalog entry"
 * action in the LE library and a commit to `catalog/catalog.json`. Nobody else writes to it, so
 * there is no submission API, no auth, and no server — just a file over raw.githubusercontent.
 */

/** The one place the catalog URL is written. */
export const CATALOG_URL =
  'https://raw.githubusercontent.com/FairyVR/fleetview/main/catalog/catalog.json'

export interface CatalogBuild {
  /** Stable slug. Never reused for a different build — installs are tracked by this. */
  id: string
  name: string
  author?: string
  description?: string
  /** Bump to signal an update to everyone who already installed this build. */
  version: number
  tags?: string[]
  category?: string
  updatedAt?: number
  /** The raw Level Editor config code. */
  code: string
}

export interface Catalog {
  version: 1
  updatedAt?: number
  builds: CatalogBuild[]
}

/** Result of a catalog read. `catalog` may be a stale cache when `error` is set. */
export interface CatalogState {
  catalog: Catalog | null
  fetchedAt: number
  error?: string
}

/** Refuse absurd payloads before they reach the store or the UI. */
export const CATALOG_MAX_BYTES = 5_000_000
export const CATALOG_MAX_BUILDS = 2000
const MAX_CODE_LENGTH = 500_000

const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim() : undefined

function parseBuild(raw: unknown): CatalogBuild | null {
  if (!raw || typeof raw !== 'object') return null
  const b = raw as Record<string, unknown>
  const id = str(b.id)
  const name = str(b.name)
  const code = typeof b.code === 'string' ? b.code : undefined
  if (!id || !name || !code || !code.trim() || code.length > MAX_CODE_LENGTH) return null

  const version = Number(b.version)
  if (!Number.isFinite(version)) return null

  const tags = Array.isArray(b.tags)
    ? b.tags.map(str).filter((t): t is string => !!t).slice(0, 24)
    : undefined
  const updatedAt = Number(b.updatedAt)

  return {
    id,
    name,
    author: str(b.author),
    description: str(b.description),
    version: Math.trunc(version),
    tags,
    category: str(b.category),
    updatedAt: Number.isFinite(updatedAt) ? updatedAt : undefined,
    code
  }
}

/**
 * Validate a catalog payload from an untrusted source (the network, or a pasted file).
 * Malformed builds are dropped individually rather than failing the whole catalog — one bad
 * entry from a hand-edit shouldn't take the catalog down for everyone. Returns null only when
 * the envelope itself is unusable.
 */
export function parseCatalog(raw: unknown): Catalog | null {
  if (!raw || typeof raw !== 'object') return null
  const c = raw as Record<string, unknown>
  if (Number(c.version) !== 1) return null
  if (!Array.isArray(c.builds)) return null

  const seen = new Set<string>()
  const builds: CatalogBuild[] = []
  for (const entry of c.builds.slice(0, CATALOG_MAX_BUILDS)) {
    const build = parseBuild(entry)
    if (!build || seen.has(build.id)) continue
    seen.add(build.id)
    builds.push(build)
  }

  const updatedAt = Number(c.updatedAt)
  return { version: 1, updatedAt: Number.isFinite(updatedAt) ? updatedAt : undefined, builds }
}
