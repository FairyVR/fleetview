/** Local (offline) library models: LE configs and reusable presets. */

export interface LeConfigVersion {
  createdAt: number
  code: string
  note?: string
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
  createdAt: number
  modifiedAt: number
  /** Prior versions, newest last. */
  history: LeConfigVersion[]
}

export type PresetKind =
  | 'arena'
  | 'gamemode'
  | 'board-layout'
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

/**
 * One LE config published to the shared GitHub library. Sharing is strictly opt-in —
 * a config only becomes a SharedLeConfig when its owner clicks Share.
 */
export interface SharedLeConfig {
  id: string
  name: string
  description?: string
  author?: string
  category?: string
  code: string
  tags: string[]
  sharedBy: string
  sharedAt: number
}

/** Merge one config into a library's config list, replacing any entry with the same id. */
export function mergeSharedConfig(configs: SharedLeConfig[], config: SharedLeConfig): SharedLeConfig[] {
  return [...configs.filter((c) => c.id !== config.id), config]
}

/** Shape of an exported/imported library bundle. */
export interface LibraryBundle {
  version: 1
  exportedAt: number
  leConfigs: LeConfig[]
  presets: Preset[]
}
