import type {
  ApiKeyRecord,
  ApiRequestArgs,
  ApiResponse,
  KeyHealth,
  PermissionSet,
  FleetProbeResult,
  RequestLogEntry,
  LeConfig,
  Preset,
  LibraryBundle
} from './models'

/** IPC channel names. Single source of truth for main + preload. */
export const CHANNELS = {
  settingsGet: 'settings:get',
  settingsSet: 'settings:set',
  keysList: 'keys:list',
  keysAdd: 'keys:add',
  keysRename: 'keys:rename',
  keysRemove: 'keys:remove',
  keysSetActive: 'keys:setActive',
  keysGetActive: 'keys:getActive',
  keysTest: 'keys:test',
  keysDiscover: 'keys:discoverPermissions',
  keysGetPermissions: 'keys:getPermissions',
  keysVerifyFleet: 'keys:verifyFleet',
  apiRequest: 'api:request',
  logsGet: 'logs:get',
  logsClear: 'logs:clear',
  logEntryEvent: 'logs:entry',
  leList: 'library:leList',
  leSave: 'library:leSave',
  leDelete: 'library:leDelete',
  leDuplicate: 'library:leDuplicate',
  presetList: 'library:presetList',
  presetSave: 'library:presetSave',
  presetDelete: 'library:presetDelete',
  bundleExport: 'library:bundleExport',
  bundleImport: 'library:bundleImport',
  secureAvailable: 'system:secureAvailable'
} as const

export type ThemeId = 'dark' | 'midnight' | 'nebula' | 'aurora' | 'light' | 'solar'

/** All selectable color themes. `light: true` = light-background theme (drives e.g. Monaco). */
export const THEMES: ReadonlyArray<{ id: ThemeId; label: string; light?: boolean }> = [
  { id: 'dark', label: 'Dark — deep space' },
  { id: 'midnight', label: 'Midnight — near black' },
  { id: 'nebula', label: 'Nebula — violet haze' },
  { id: 'aurora', label: 'Aurora — emerald dark' },
  { id: 'light', label: 'Light — daylight', light: true },
  { id: 'solar', label: 'Solar — warm paper', light: true }
]

export function isLightTheme(theme: string | undefined): boolean {
  return !!THEMES.find((t) => t.id === theme)?.light
}

export interface AppSettings {
  baseUrl: string
  requestTimeoutMs: number
  maxRetries: number
  theme: ThemeId
  developerMode: boolean
  /** Show internal IDs (fleet/station/player) in lists. Off by default. */
  showIds: boolean
  /** Unlocks the Danger Zone section (raw movement-physics writes). Off by default. */
  dangerZone: boolean
}

/** The typed surface exposed to the renderer as `window.api`. */
export interface FleetViewApi {
  getSettings(): Promise<AppSettings>
  setSettings(patch: Partial<AppSettings>): Promise<AppSettings>

  listKeys(): Promise<ApiKeyRecord[]>
  addKey(input: { name: string; owner?: string; secret: string }): Promise<ApiKeyRecord>
  renameKey(keyId: string, name: string, owner?: string): Promise<void>
  removeKey(keyId: string): Promise<void>
  setActiveKey(keyId: string | null): Promise<void>
  getActiveKeyId(): Promise<string | null>
  testKey(keyId: string): Promise<{ health: KeyHealth; message: string }>
  discoverPermissions(keyId: string): Promise<PermissionSet>
  getPermissions(keyId: string): Promise<PermissionSet>
  verifyFleetAccess(keyId: string, fleetId: string, testWrite?: boolean): Promise<FleetProbeResult[]>

  request<T = unknown>(args: ApiRequestArgs): Promise<ApiResponse<T>>

  getLogs(): Promise<RequestLogEntry[]>
  clearLogs(): Promise<void>
  onLog(cb: (entry: RequestLogEntry) => void): () => void

  listLeConfigs(): Promise<LeConfig[]>
  saveLeConfig(input: Partial<LeConfig> & { name: string; code: string }): Promise<LeConfig>
  deleteLeConfig(id: string): Promise<void>
  duplicateLeConfig(id: string): Promise<LeConfig | null>

  listPresets(): Promise<Preset[]>
  savePreset(input: Partial<Preset> & { kind: Preset['kind']; name: string; data: unknown }): Promise<Preset>
  deletePreset(id: string): Promise<void>

  exportBundle(): Promise<LibraryBundle>
  importBundle(bundle: LibraryBundle): Promise<{ leConfigs: number; presets: number }>

  isSecureStorageAvailable(): Promise<boolean>
}
