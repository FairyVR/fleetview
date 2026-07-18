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
    activeKeyId: settingsStore.get('activeKeyId'),
    requestTimeoutMs: settingsStore.get('requestTimeoutMs'),
    maxRetries: settingsStore.get('maxRetries'),
    theme: settingsStore.get('theme'),
    developerMode: settingsStore.get('developerMode')
  }
}

export function registerIpc(getWindow: () => BrowserWindow | null): void {
  const h = ipcMain.handle.bind(ipcMain)

  // Settings
  h(CHANNELS.settingsGet, () => readSettings())
  h(CHANNELS.settingsSet, (_e, patch: Partial<AppSettings>) => {
    for (const [k, v] of Object.entries(patch)) settingsStore.set(k as keyof AppSettings, v as never)
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
