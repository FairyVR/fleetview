import { contextBridge, ipcRenderer } from 'electron'
import { CHANNELS, type FleetViewApi } from '@shared/ipc'
import type { RequestLogEntry } from '@shared/models'

const api: FleetViewApi = {
  getSettings: () => ipcRenderer.invoke(CHANNELS.settingsGet),
  setSettings: (patch) => ipcRenderer.invoke(CHANNELS.settingsSet, patch),

  listKeys: () => ipcRenderer.invoke(CHANNELS.keysList),
  addKey: (input) => ipcRenderer.invoke(CHANNELS.keysAdd, input),
  renameKey: (keyId, name, owner) => ipcRenderer.invoke(CHANNELS.keysRename, keyId, name, owner),
  removeKey: (keyId) => ipcRenderer.invoke(CHANNELS.keysRemove, keyId),
  setActiveKey: (keyId) => ipcRenderer.invoke(CHANNELS.keysSetActive, keyId),
  getActiveKeyId: () => ipcRenderer.invoke(CHANNELS.keysGetActive),
  testKey: (keyId) => ipcRenderer.invoke(CHANNELS.keysTest, keyId),
  discoverPermissions: (keyId) => ipcRenderer.invoke(CHANNELS.keysDiscover, keyId),
  getPermissions: (keyId) => ipcRenderer.invoke(CHANNELS.keysGetPermissions, keyId),
  verifyFleetAccess: (keyId, fleetId, testWrite) =>
    ipcRenderer.invoke(CHANNELS.keysVerifyFleet, keyId, fleetId, testWrite),

  request: (args) => ipcRenderer.invoke(CHANNELS.apiRequest, args),

  getLogs: () => ipcRenderer.invoke(CHANNELS.logsGet),
  clearLogs: () => ipcRenderer.invoke(CHANNELS.logsClear),
  onLog: (cb: (entry: RequestLogEntry) => void) => {
    const listener = (_e: unknown, entry: RequestLogEntry) => cb(entry)
    ipcRenderer.on(CHANNELS.logEntryEvent, listener)
    return () => ipcRenderer.removeListener(CHANNELS.logEntryEvent, listener)
  },

  listLeConfigs: () => ipcRenderer.invoke(CHANNELS.leList),
  saveLeConfig: (input) => ipcRenderer.invoke(CHANNELS.leSave, input),
  deleteLeConfig: (id) => ipcRenderer.invoke(CHANNELS.leDelete, id),
  duplicateLeConfig: (id) => ipcRenderer.invoke(CHANNELS.leDuplicate, id),

  listPresets: () => ipcRenderer.invoke(CHANNELS.presetList),
  savePreset: (input) => ipcRenderer.invoke(CHANNELS.presetSave, input),
  deletePreset: (id) => ipcRenderer.invoke(CHANNELS.presetDelete, id),

  exportBundle: () => ipcRenderer.invoke(CHANNELS.bundleExport),
  importBundle: (bundle) => ipcRenderer.invoke(CHANNELS.bundleImport, bundle),

  isSecureStorageAvailable: () => ipcRenderer.invoke(CHANNELS.secureAvailable)
}

contextBridge.exposeInMainWorld('api', api)
