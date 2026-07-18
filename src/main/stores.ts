import Store from 'electron-store'
import type { ApiKeyRecord, PermissionSet } from '@shared/models'
import type { LeConfig, Preset } from '@shared/models'

/** App settings. */
export interface Settings {
  /** Base URL of the Orion Drift API (verified from the official dashboard client). */
  baseUrl: string
  activeKeyId: string | null
  requestTimeoutMs: number
  maxRetries: number
  theme: 'dark' | 'light'
  developerMode: boolean
}

const DEFAULT_SETTINGS: Settings = {
  baseUrl: 'https://api.oriondrift.net',
  activeKeyId: null,
  requestTimeoutMs: 15000,
  maxRetries: 2,
  theme: 'dark',
  developerMode: false
}

export const settingsStore = new Store<Settings>({
  name: 'settings',
  defaults: DEFAULT_SETTINGS
})

/** Public key metadata (never the secret). */
export const keysStore = new Store<{ keys: ApiKeyRecord[] }>({
  name: 'keys',
  defaults: { keys: [] }
})

/** Encrypted key secrets: keyId -> base64(safeStorage-encrypted secret). */
export const secretsStore = new Store<{ secrets: Record<string, string> }>({
  name: 'secrets',
  defaults: { secrets: {} }
})

/** Discovered permission sets: keyId -> PermissionSet. */
export const permissionsStore = new Store<{ perms: Record<string, PermissionSet> }>({
  name: 'permissions',
  defaults: { perms: {} }
})

/** Local library: LE configs + presets. */
export const libraryStore = new Store<{ leConfigs: LeConfig[]; presets: Preset[] }>({
  name: 'library',
  defaults: { leConfigs: [], presets: [] }
})
