/** Local (offline) library models: LE configs and reusable presets. */

export interface LeConfigVersion {
  createdAt: number
  code: string
  note?: string
}

/** Where an installed config came from, so catalog version bumps can be surfaced. */
export interface LeConfigSource {
  catalogId: string
  /** The catalog build's `version` at the time it was installed/updated. */
  version: number
  author?: string
}

export interface LeConfig {
  id: string
  name: string
  description?: string
  author?: string
  category?: string
  /** The raw Level Editor config code. */
  code: string
  tags: string[]
  notes?: string
  favorite: boolean
  /** Client-side folder path, '/'-separated (e.g. 'Maps/Race'). Absent = ungrouped. */
  folder?: string
  /** Present only when this config was installed from the community catalog. */
  source?: LeConfigSource
  createdAt: number
  modifiedAt: number
  /** Prior versions, newest last. */
  history: LeConfigVersion[]
}

/** Longest folder path we accept, so a pasted bundle can't produce an unusable tree. */
export const MAX_FOLDER_DEPTH = 8

/**
 * Canonicalize a folder path: trim each segment, drop empties (so `a//b` and `/a/b/` collapse),
 * and cap depth. Returns undefined for "no folder", which is how a config lands in Ungrouped.
 */
export function normalizeFolder(raw: string | undefined | null): string | undefined {
  if (typeof raw !== 'string') return undefined
  const segments = raw
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX_FOLDER_DEPTH)
  return segments.length ? segments.join('/') : undefined
}

export type PresetKind =
  | 'arena'
  | 'gamemode'
  | 'board-layout'
  /** The per-board URL library: one record holding every board slot's saved and recent URLs. */
  | 'board-slot'
  | 'le-config'
  | 'spawn'
  | 'team'
  | 'config'

/** A generic reusable preset stored in the local Config Library. */
export interface Preset {
  id: string
  kind: PresetKind
  name: string
  description?: string
  tags: string[]
  /** Arbitrary JSON payload for this preset kind. */
  data: unknown
  createdAt: number
  modifiedAt: number
}

/** Shape of an exported/imported library bundle. */
export interface LibraryBundle {
  version: 1
  exportedAt: number
  leConfigs: LeConfig[]
  presets: Preset[]
}
