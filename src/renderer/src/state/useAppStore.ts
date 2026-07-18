import { create } from 'zustand'
import type { ApiKeyRecord, PermissionSet } from '@shared/models'
import { EMPTY_PERMISSIONS, hasScope, isDiscovered } from '@shared/models'
import type { AppSettings } from '@shared/ipc'
import { api } from '../lib/api'

export type PermissionState = 'allowed' | 'denied' | 'unknown'

interface AppState {
  loaded: boolean
  settings: AppSettings | null
  keys: ApiKeyRecord[]
  activeKeyId: string | null
  permissions: PermissionSet
  secureStorageAvailable: boolean

  load: () => Promise<void>
  refreshKeys: () => Promise<void>
  setActiveKey: (keyId: string | null) => Promise<void>
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>
  /** Discover & cache permissions for the active key. */
  discoverActive: () => Promise<void>
  /** Gate helper for the UI. Unknown when no permissions discovered yet. */
  permissionState: (scope: string) => PermissionState
}

export const useAppStore = create<AppState>((set, get) => ({
  loaded: false,
  settings: null,
  keys: [],
  activeKeyId: null,
  permissions: EMPTY_PERMISSIONS,
  secureStorageAvailable: true,

  load: async () => {
    const [settings, keys, activeKeyId, secure] = await Promise.all([
      api.getSettings(),
      api.listKeys(),
      api.getActiveKeyId(),
      api.isSecureStorageAvailable()
    ])
    const permissions = activeKeyId ? await api.getPermissions(activeKeyId) : EMPTY_PERMISSIONS
    set({ loaded: true, settings, keys, activeKeyId, permissions, secureStorageAvailable: secure })
  },

  refreshKeys: async () => {
    const [keys, activeKeyId] = await Promise.all([api.listKeys(), api.getActiveKeyId()])
    set({ keys, activeKeyId })
  },

  setActiveKey: async (keyId) => {
    await api.setActiveKey(keyId)
    const permissions = keyId ? await api.getPermissions(keyId) : EMPTY_PERMISSIONS
    set({ activeKeyId: keyId, permissions })
  },

  updateSettings: async (patch) => {
    const settings = await api.setSettings(patch)
    set({ settings })
  },

  discoverActive: async () => {
    const id = get().activeKeyId
    if (!id) return
    const permissions = await api.discoverPermissions(id)
    set({ permissions })
    await get().refreshKeys()
  },

  permissionState: (scope) => {
    const perms = get().permissions
    if (scope === 'none') return 'allowed'
    // No successfully-parsed grants -> unknown; never deny on unknown.
    if (!isDiscovered(perms)) return 'unknown'
    if (hasScope(perms, scope)) return 'allowed'
    // Probed grants come from read-only probes and can't see write scopes —
    // absence proves nothing, so only explicit scope lists may deny.
    return perms.source === 'explicit' ? 'denied' : 'unknown'
  }
}))
