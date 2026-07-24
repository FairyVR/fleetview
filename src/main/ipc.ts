import { ipcMain, type BrowserWindow } from 'electron'
import { CHANNELS, type AppSettings } from '@shared/ipc'
import { settingsStore } from './stores'
import { isEncryptionAvailable } from './secure-storage'
import { executeRequest } from './api-client'
import { getLogs, clearLogs, onLog } from './logger'
import {
  listKeys,
  addKey,
  renameKey,
  removeKey,
  setActiveKey,
  getActiveKeyId,
  testKey,
  discoverPermissions,
  getPermissions,
  verifyFleetAccess
} from './key-service'
import {
  listLeConfigs,
  saveLeConfig,
  deleteLeConfig,
  duplicateLeConfig,
  listPresets,
  savePreset,
  deletePreset,
  exportBundle,
  importBundle
} from './library-service'

function readSettings(): AppSettings {
  return {
    baseUrl: settingsStore.get('baseUrl'),
    requestTimeoutMs: settingsStore.get('requestTimeoutMs'),
    maxRetries: settingsStore.get('maxRetries'),
    theme: settingsStore.get('theme'),
    developerMode: settingsStore.get('developerMode'),
    showIds: settingsStore.get('showIds'),
    dangerZone: settingsStore.get('dangerZone')
  }
}

/**
 * The active key (a secret JWT) is attached to every request aimed at `baseUrl`. If the
 * renderer were ever compromised it could repoint `baseUrl` at an attacker host and
 * exfiltrate the key without ever reading it — the one way to bypass secret isolation
 * through the sanctioned IPC surface. So the main process (not the renderer) is the
 * authority: require https and an oriondrift.net host, unless Developer Mode is on for
 * local proxy/testing.
 */
function assertValidBaseUrl(raw: unknown): void {
  if (typeof raw !== 'string') throw new Error('baseUrl must be a string.')
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error(`Invalid base URL: ${raw}`)
  }
  if (settingsStore.get('developerMode')) return
  if (url.protocol !== 'https:') throw new Error('Base URL must use https.')
  const host = url.hostname.toLowerCase()
  if (host !== 'oriondrift.net' && !host.endsWith('.oriondrift.net')) {
    throw new Error(
      `Base URL host "${url.hostname}" is not an oriondrift.net host. Enable Developer Mode to override.`
    )
  }
}

/** Validate + coerce an incoming settings patch at the trust boundary before it is persisted. */
function sanitizeSettingsPatch(patch: Partial<AppSettings>): Partial<AppSettings> {
  const out: Partial<AppSettings> = {}
  if ('baseUrl' in patch) {
    assertValidBaseUrl(patch.baseUrl)
    out.baseUrl = String(patch.baseUrl)
  }
  if ('requestTimeoutMs' in patch) {
    const n = Number(patch.requestTimeoutMs)
    if (!Number.isFinite(n)) throw new Error('requestTimeoutMs must be a number.')
    out.requestTimeoutMs = Math.min(120_000, Math.max(1000, Math.round(n)))
  }
  if ('maxRetries' in patch) {
    const n = Number(patch.maxRetries)
    if (!Number.isFinite(n)) throw new Error('maxRetries must be a number.')
    out.maxRetries = Math.min(10, Math.max(0, Math.round(n)))
  }
  if ('theme' in patch) out.theme = patch.theme
  if ('developerMode' in patch) out.developerMode = !!patch.developerMode
  if ('showIds' in patch) out.showIds = !!patch.showIds
  if ('dangerZone' in patch) out.dangerZone = !!patch.dangerZone
  return out
}

export function registerIpc(getWindow: () => BrowserWindow | null): void {
  const h = ipcMain.handle.bind(ipcMain)

  // Settings
  h(CHANNELS.settingsGet, () => readSettings())
  h(CHANNELS.settingsSet, (_e, patch: Partial<AppSettings>) => {
    const clean = sanitizeSettingsPatch(patch ?? {})
    for (const [k, v] of Object.entries(clean)) settingsStore.set(k as keyof AppSettings, v as never)
    return readSettings()
  })

  // Keys
  h(CHANNELS.keysList, () => listKeys())
  h(CHANNELS.keysAdd, (_e, input) => addKey(input))
  h(CHANNELS.keysRename, (_e, keyId: string, name: string, owner?: string) => renameKey(keyId, name, owner))
  h(CHANNELS.keysRemove, (_e, keyId: string) => removeKey(keyId))
  h(CHANNELS.keysSetActive, (_e, keyId: string | null) => setActiveKey(keyId))
  h(CHANNELS.keysGetActive, () => getActiveKeyId())
  h(CHANNELS.keysTest, (_e, keyId: string) => testKey(keyId))
  h(CHANNELS.keysDiscover, (_e, keyId: string) => discoverPermissions(keyId))
  h(CHANNELS.keysGetPermissions, (_e, keyId: string) => getPermissions(keyId))
  h(CHANNELS.keysVerifyFleet, (_e, keyId: string, fleetId: string, testWrite?: boolean) =>
    verifyFleetAccess(keyId, fleetId, testWrite)
  )

  // API execution
  h(CHANNELS.apiRequest, (_e, args) => executeRequest(args))

  // Logs
  h(CHANNELS.logsGet, () => getLogs())
  h(CHANNELS.logsClear, () => clearLogs())
  onLog((entry) => getWindow()?.webContents.send(CHANNELS.logEntryEvent, entry))

  // Library
  h(CHANNELS.leList, () => listLeConfigs())
  h(CHANNELS.leSave, (_e, input) => saveLeConfig(input))
  h(CHANNELS.leDelete, (_e, id: string) => deleteLeConfig(id))
  h(CHANNELS.leDuplicate, (_e, id: string) => duplicateLeConfig(id))
  h(CHANNELS.presetList, () => listPresets())
  h(CHANNELS.presetSave, (_e, input) => savePreset(input))
  h(CHANNELS.presetDelete, (_e, id: string) => deletePreset(id))
  h(CHANNELS.bundleExport, () => exportBundle())
  h(CHANNELS.bundleImport, (_e, bundle) => importBundle(bundle))

  // System
  h(CHANNELS.secureAvailable, () => isEncryptionAvailable())
}
