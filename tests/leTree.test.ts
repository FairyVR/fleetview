import { describe, it, expect } from 'vitest'
import type { LeConfig } from '../src/shared/models'
import { normalizeFolder } from '../src/shared/models'
import { buildFolderTree, folderPaths, renameFolder, UNGROUPED } from '../src/renderer/src/lib/leTree'

function config(name: string, folder?: string): LeConfig {
  return {
    id: name,
    name,
    code: 'x',
    tags: [],
    favorite: false,
    folder,
    createdAt: 0,
    modifiedAt: 0,
    history: []
  }
}

describe('normalizeFolder', () => {
  it('collapses separators and trims segments', () => {
    expect(normalizeFolder('/Maps//  Race /')).toBe('Maps/Race')
  })

  it('treats empty and whitespace as ungrouped', () => {
    expect(normalizeFolder('')).toBeUndefined()
    expect(normalizeFolder('  /  ')).toBeUndefined()
    expect(normalizeFolder(undefined)).toBeUndefined()
  })

  it('caps depth', () => {
    expect(normalizeFolder('a/b/c/d/e/f/g/h/i/j')).toBe('a/b/c/d/e/f/g/h')
  })
})

describe('buildFolderTree', () => {
  it('nests by path segment and rolls up counts', () => {
    const tree = buildFolderTree([
      config('Canyon', 'Maps/Race'),
      config('Loop', 'Maps/Race'),
      config('Dome', 'Maps/Arena'),
      config('Tag', 'Gamemodes')
    ])

    expect(tree.map((n) => n.name)).toEqual(['Gamemodes', 'Maps'])
    const maps = tree.find((n) => n.name === 'Maps')!
    expect(maps.count).toBe(3)
    expect(maps.configs).toHaveLength(0)
    expect(maps.children.map((c) => c.path)).toEqual(['Maps/Arena', 'Maps/Race'])
    expect(maps.children.find((c) => c.name === 'Race')!.configs.map((c) => c.name)).toEqual([
      'Canyon',
      'Loop'
    ])
  })

  it('puts folderless configs in an Ungrouped bucket, last', () => {
    const tree = buildFolderTree([config('Scratch'), config('Canyon', 'Maps')])
    expect(tree.map((n) => n.name)).toEqual(['Maps', UNGROUPED])
    expect(tree[1].configs.map((c) => c.name)).toEqual(['Scratch'])
  })

  it('has no Ungrouped node when everything is filed', () => {
    const tree = buildFolderTree([config('Canyon', 'Maps')])
    expect(tree.map((n) => n.name)).toEqual(['Maps'])
  })

  it('returns an empty tree for no configs', () => {
    expect(buildFolderTree([])).toEqual([])
  })

  it('shows extraFolders as empty branches so a new folder stays visible', () => {
    const tree = buildFolderTree([], ['Maps/Race'])
    expect(tree.map((n) => n.name)).toEqual(['Maps'])
    const race = tree[0].children[0]
    expect(race.path).toBe('Maps/Race')
    expect(race.count).toBe(0)
    expect(race.configs).toEqual([])
  })

  it('merges an extraFolder with a folder that already has configs', () => {
    const tree = buildFolderTree([config('Canyon', 'Maps/Race')], ['Maps/Race', 'Maps/Arena'])
    const maps = tree.find((n) => n.name === 'Maps')!
    expect(maps.children.map((c) => c.name)).toEqual(['Arena', 'Race'])
    expect(maps.count).toBe(1)
    expect(maps.children.find((c) => c.name === 'Race')!.configs).toHaveLength(1)
  })

  it('ignores blank extraFolders', () => {
    expect(buildFolderTree([], ['', '  ', '//'])).toEqual([])
  })
})

describe('folderPaths', () => {
  it('includes parent paths and deduplicates', () => {
    expect(folderPaths([config('a', 'Maps/Race'), config('b', 'Maps/Race'), config('c')])).toEqual([
      'Maps',
      'Maps/Race'
    ])
  })
})

describe('renameFolder', () => {
  it('moves the folder and its descendants', () => {
    const configs = [config('a', 'Maps'), config('b', 'Maps/Race')]
    expect(renameFolder(configs, 'Maps', 'Tracks')).toEqual([
      { config: configs[0], folder: 'Tracks' },
      { config: configs[1], folder: 'Tracks/Race' }
    ])
  })

  it('does not touch folders that merely share a prefix', () => {
    const configs = [config('a', 'Maps'), config('b', 'MapsOld'), config('c', 'OtherMaps')]
    const moved = renameFolder(configs, 'Maps', 'Tracks')
    expect(moved.map((m) => m.config.name)).toEqual(['a'])
  })

  it('renaming to nothing flattens the subtree to ungrouped', () => {
    const configs = [config('a', 'Maps'), config('b', 'Maps/Race')]
    expect(renameFolder(configs, 'Maps', '')).toEqual([
      { config: configs[0], folder: undefined },
      { config: configs[1], folder: 'Race' }
    ])
  })

  it('can nest a folder under another', () => {
    const configs = [config('a', 'Race')]
    expect(renameFolder(configs, 'Race', 'Maps/Race')).toEqual([
      { config: configs[0], folder: 'Maps/Race' }
    ])
  })

  it('ignores an empty source path', () => {
    expect(renameFolder([config('a', 'Maps')], '', 'Tracks')).toEqual([])
  })
})
