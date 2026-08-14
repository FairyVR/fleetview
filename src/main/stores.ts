import Store from 'electron-store'
import type { ApiKeyRecord, PermissionSet } from '@shared/models'
import type { LeConfig, Preset } from '@shared/models'
import type { Catalog } from '@shared/catalog'
import type { DiscordPrivacy, ThemeId } from '@shared/ipc'

/** App settings. */
export interface Settings {
  /** Base URL of the Orion Drift API (verified from the official dashboard client). */
  baseUrl: string
  activeKeyId: string | null
  requestTimeoutMs: number
  maxRetries: number
  theme: ThemeId
  developerMode: boolean
  showIds: boolean
  dangerZone: boolean
  /** Overview auto-refresh interval in seconds; 0 = off. */
  overviewPollSeconds: number
  /** How much detail Discord rich presence publishes. */
  discordPrivacy: DiscordPrivacy
  /** Last fleet/station context, restored on startup. */
  lastFleetId: string | null
  lastFleetName: string | null
  lastStationId: string | null
  lastStationName: string | null
}

const DEFAULT_SETTINGS: Settings = {
  baseUrl: 'https://api.oriondrift.net/v2',
  activeKeyId: null,
  requestTimeoutMs: 15000,
  maxRetries: 2,
  theme: 'dark',
  developerMode: false,
  showIds: false,
  dangerZone: false,
  overviewPollSeconds: 0,
  discordPrivacy: 'off',
  lastFleetId: null,
  lastFleetName: null,
  lastStationId: null,
  lastStationName: null
}

/**
 * A store that resets itself instead of taking the app down. An unparseable file (partial
 * write, stray BOM, hand-edit) otherwise throws inside the constructor at import time, which
 * is an uncaught exception in the main process — the app never opens a window.
 */
function store<T extends object>(name: string, defaults: T): Store<T> {
  return new Store<T>({ name, defaults, clearInvalidConfig: true })
}

export const settingsStore = store<Settings>('settings', DEFAULT_SETTINGS)

/** Public key metadata (never the secret). */
export const keysStore = store('keys', { keys: [] as ApiKeyRecord[] })

/** Encrypted key secrets: keyId -> base64(safeStorage-encrypted secret). */
export const secretsStore = store('secrets', { secrets: {} as Record<string, string> })

/** Discovered permission sets: keyId -> PermissionSet. */
export const permissionsStore = store('permissions', { perms: {} as Record<string, PermissionSet> })

/** Local library: LE configs + presets. */
export const libraryStore = store('library', {
  leConfigs: [] as LeConfig[],
  presets: [] as Preset[]
})

/** Cached copy of the remote community catalog, so the page works offline. */
export const catalogStore = store('catalog', {
  catalog: null as Catalog | null,
  fetchedAt: 0,
  etag: null as string | null
})
