import { describe, it, expect } from 'vitest'
import { parseCatalog, CATALOG_MAX_BUILDS, type Catalog } from '../src/shared/catalog'
import type { LeConfig } from '../src/shared/models'
import {
  catalogEntryFrom,
  installPayload,
  installedFor,
  slugify,
  updateState
} from '../src/renderer/src/lib/catalog'

const build = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 'canyon-sprint',
  name: 'Canyon Sprint',
  version: 1,
  code: 'a,\nb',
  ...over
})

function config(over: Partial<LeConfig> = {}): LeConfig {
  return {
    id: 'local-1',
    name: 'Canyon Sprint',
    code: 'a,\nb',
    tags: [],
    favorite: false,
    createdAt: 0,
    modifiedAt: 0,
    history: [],
    ...over
  }
}

describe('parseCatalog', () => {
  it('accepts a well-formed catalog', () => {
    const c = parseCatalog({ version: 1, updatedAt: 5, builds: [build()] })
    expect(c?.builds).toHaveLength(1)
    expect(c?.builds[0]).toMatchObject({ id: 'canyon-sprint', version: 1, code: 'a,\nb' })
  })

  it('rejects a bad envelope', () => {
    expect(parseCatalog(null)).toBeNull()
    expect(parseCatalog('nope')).toBeNull()
    expect(parseCatalog({ version: 2, builds: [] })).toBeNull()
    expect(parseCatalog({ version: 1 })).toBeNull()
  })

  it('drops malformed builds but keeps the good ones', () => {
    const c = parseCatalog({
      version: 1,
      builds: [
        build(),
        build({ id: 'no-code', code: undefined }),
        build({ id: 'blank-code', code: '   ' }),
        build({ id: 'no-name', name: '' }),
        build({ id: 'bad-version', version: 'soon' }),
        null,
        'garbage'
      ]
    })
    expect(c?.builds.map((b) => b.id)).toEqual(['canyon-sprint'])
  })

  it('drops duplicate ids, keeping the first', () => {
    const c = parseCatalog({
      version: 1,
      builds: [build({ name: 'First' }), build({ name: 'Second' })]
    })
    expect(c?.builds.map((b) => b.name)).toEqual(['First'])
  })

  it('rejects an oversized code blob', () => {
    const c = parseCatalog({ version: 1, builds: [build({ code: 'x'.repeat(600_000) })] })
    expect(c?.builds).toHaveLength(0)
  })

  it('caps the number of builds', () => {
    const builds = Array.from({ length: CATALOG_MAX_BUILDS + 50 }, (_, i) => build({ id: `b${i}` }))
    expect(parseCatalog({ version: 1, builds })?.builds).toHaveLength(CATALOG_MAX_BUILDS)
  })

  it('trims strings and ignores non-string tags', () => {
    const c = parseCatalog({
      version: 1,
      builds: [build({ name: '  Canyon  ', tags: ['race', 42, '', ' map '] })]
    })
    expect(c?.builds[0].name).toBe('Canyon')
    expect(c?.builds[0].tags).toEqual(['race', 'map'])
  })
})

describe('updateState', () => {
  const catalog: Catalog = { version: 1, builds: [build({ version: 3 })] as Catalog['builds'] }

  it('is none for a config the user made themselves', () => {
    expect(updateState(config(), catalog)).toBe('none')
  })

  it('is current when versions match', () => {
    const c = config({ source: { catalogId: 'canyon-sprint', version: 3 } })
    expect(updateState(c, catalog)).toBe('current')
  })

  it('is update when the catalog is ahead', () => {
    const c = config({ source: { catalogId: 'canyon-sprint', version: 2 } })
    expect(updateState(c, catalog)).toBe('update')
  })

  it('is missing when the build was pulled, and never crashes without a catalog', () => {
    const c = config({ source: { catalogId: 'gone', version: 1 } })
    expect(updateState(c, catalog)).toBe('missing')
    expect(updateState(c, null)).toBe('missing')
  })
})

describe('installedFor', () => {
  it('matches on catalog id, not name', () => {
    const mine = config({ id: 'x', name: 'Canyon Sprint' })
    const installed = config({ id: 'y', source: { catalogId: 'canyon-sprint', version: 1 } })
    expect(installedFor(build() as never, [mine, installed])?.id).toBe('y')
  })
})

describe('slugify', () => {
  it('produces a stable id', () => {
    expect(slugify('  Canyon Sprint!! ')).toBe('canyon-sprint')
    expect(slugify('Tag v2')).toBe('tag-v2')
  })
})

describe('catalogEntryFrom', () => {
  it('starts a fresh build at version 1 and omits blank fields', () => {
    const entry = catalogEntryFrom(config({ author: '  ', description: '' }))
    expect(entry.id).toBe('canyon-sprint')
    expect(entry.version).toBe(1)
    expect('author' in entry).toBe(false)
    expect('description' in entry).toBe(false)
    expect(entry.code).toBe('a,\nb')
  })

  it('republishing keeps the id and bumps the version', () => {
    const entry = catalogEntryFrom(
      config({ name: 'Renamed', source: { catalogId: 'canyon-sprint', version: 4 } })
    )
    expect(entry.id).toBe('canyon-sprint')
    expect(entry.version).toBe(5)
  })

  it('is JSON-serializable with the code escaped', () => {
    const json = JSON.stringify(catalogEntryFrom(config({ code: 'a "quoted",\nb' })))
    expect(JSON.parse(json).code).toBe('a "quoted",\nb')
  })
})

describe('installPayload', () => {
  it('files the build under Downloaded and records its source', () => {
    const p = installPayload(build({ author: 'someone', version: 3 }) as never)
    expect(p.folder).toBe('Downloaded')
    expect(p.source).toEqual({ catalogId: 'canyon-sprint', version: 3, author: 'someone' })
  })
})
