import { normalizeFolder, type LeConfig } from '@shared/models'

export { normalizeFolder }

/** Label for configs with no folder. Not a real path — it never appears in `folder`. */
export const UNGROUPED = 'Ungrouped'

export interface FolderNode {
  name: string
  /** Full '/'-joined path, '' for the synthetic ungrouped bucket. */
  path: string
  children: FolderNode[]
  /** Configs directly in this folder (not in its children). */
  configs: LeConfig[]
  /** Configs here and everywhere below. */
  count: number
}

/** Every distinct folder path in use, sorted. Feeds the folder autocomplete. */
export function folderPaths(configs: LeConfig[]): string[] {
  const paths = new Set<string>()
  for (const c of configs) {
    const folder = normalizeFolder(c.folder)
    if (!folder) continue
    // Offer parents too, so 'Maps' is suggested even if only 'Maps/Race' exists.
    const segments = folder.split('/')
    for (let i = 1; i <= segments.length; i++) paths.add(segments.slice(0, i).join('/'))
  }
  return [...paths].sort((a, b) => a.localeCompare(b))
}

/**
 * Build the folder tree for the library sidebar. Ungrouped configs go into a synthetic node
 * that always sorts last, so an empty `folder` never silently hides a config.
 */
export function buildFolderTree(configs: LeConfig[]): FolderNode[] {
  const root: FolderNode = { name: '', path: '', children: [], configs: [], count: 0 }
  const ungrouped: LeConfig[] = []

  for (const config of configs) {
    const folder = normalizeFolder(config.folder)
    if (!folder) {
      ungrouped.push(config)
      continue
    }
    let node = root
    for (const segment of folder.split('/')) {
      const path = node.path ? `${node.path}/${segment}` : segment
      let child = node.children.find((c) => c.name === segment)
      if (!child) {
        child = { name: segment, path, children: [], configs: [], count: 0 }
        node.children.push(child)
      }
      node = child
    }
    node.configs.push(config)
  }

  const finish = (node: FolderNode): number => {
    node.children.sort((a, b) => a.name.localeCompare(b.name))
    node.configs.sort((a, b) => a.name.localeCompare(b.name))
    node.count = node.configs.length + node.children.reduce((sum, c) => sum + finish(c), 0)
    return node.count
  }
  finish(root)

  const tree = root.children
  if (ungrouped.length) {
    tree.push({
      name: UNGROUPED,
      path: '',
      children: [],
      configs: ungrouped.sort((a, b) => a.name.localeCompare(b.name)),
      count: ungrouped.length
    })
  }
  return tree
}

/**
 * Configs whose `folder` needs rewriting to rename `from` to `to`, with the new value.
 *
 * Matching is on a segment boundary so renaming 'Maps' leaves 'MapsOld' alone — a plain
 * `startsWith` would drag unrelated folders along with it.
 */
export function renameFolder(
  configs: LeConfig[],
  from: string,
  to: string
): Array<{ config: LeConfig; folder: string | undefined }> {
  const oldPath = normalizeFolder(from)
  if (!oldPath) return []
  const newPath = normalizeFolder(to)

  const out: Array<{ config: LeConfig; folder: string | undefined }> = []
  for (const config of configs) {
    const folder = normalizeFolder(config.folder)
    if (!folder) continue
    if (folder !== oldPath && !folder.startsWith(`${oldPath}/`)) continue
    const rest = folder.slice(oldPath.length) // '' or '/child/...'
    // Renaming to empty flattens the subtree to ungrouped rather than leaving a stray '/child'.
    out.push({ config, folder: newPath ? `${newPath}${rest}` : normalizeFolder(rest) })
  }
  return out
}
