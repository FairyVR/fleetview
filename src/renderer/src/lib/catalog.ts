import type { Catalog, CatalogBuild } from '@shared/catalog'
import type { LeConfig } from '@shared/models'

/** Folder installed builds land in, so they don't scatter through the user's own tree. */
export const CATALOG_FOLDER = 'Downloaded'

/** How an installed config compares to the catalog build it came from. */
export type UpdateState = 'none' | 'current' | 'update' | 'missing'

export function updateState(config: LeConfig, catalog: Catalog | null): UpdateState {
  if (!config.source) return 'none'
  const build = catalog?.builds.find((b) => b.id === config.source!.catalogId)
  if (!build) return 'missing'
  return build.version > config.source.version ? 'update' : 'current'
}

/** The installed copy of a catalog build, if there is one. */
export function installedFor(build: CatalogBuild, configs: LeConfig[]): LeConfig | undefined {
  return configs.find((c) => c.source?.catalogId === build.id)
}

/** URL-ish slug used as a catalog id. Same idiom as the single-config export filename. */
export function slugify(name: string): string {
  return name.trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase()
}

/**
 * Turn one of the maintainer's own library configs into a publishable catalog entry.
 * `version` starts at 1 — bump it by hand in catalog.json when republishing an existing id.
 */
export function catalogEntryFrom(config: LeConfig): CatalogBuild {
  return {
    id: config.source?.catalogId || slugify(config.name) || 'build',
    name: config.name.trim(),
    ...(config.author?.trim() ? { author: config.author.trim() } : {}),
    ...(config.description?.trim() ? { description: config.description.trim() } : {}),
    version: config.source ? config.source.version + 1 : 1,
    ...(config.tags?.length ? { tags: config.tags } : {}),
    ...(config.category?.trim() ? { category: config.category.trim() } : {}),
    updatedAt: Date.now(),
    code: config.code
  }
}

/** The fields a catalog install writes into the local library. */
export function installPayload(
  build: CatalogBuild
): Partial<LeConfig> & { name: string; code: string } {
  return {
    name: build.name,
    code: build.code,
    description: build.description,
    author: build.author,
    category: build.category,
    tags: build.tags ?? [],
    folder: CATALOG_FOLDER,
    source: { catalogId: build.id, version: build.version, author: build.author }
  }
}
