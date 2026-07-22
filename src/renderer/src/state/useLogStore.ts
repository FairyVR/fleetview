import { create } from 'zustand'
import type { RequestLogEntry } from '@shared/models'
import { api } from '../lib/api'

interface LogState {
  logs: RequestLogEntry[]
  subscribed: boolean
  init: () => Promise<void>
  clear: () => Promise<void>
}

export const useLogStore = create<LogState>((set, get) => ({
  logs: [],
  subscribed: false,
  init: async () => {
    // Subscribe synchronously (before the await) so two init() calls in the same tick
    // can't both pass the check and double-register the listener.
    if (!get().subscribed) {
      set({ subscribed: true })
      api.onLog((entry) => set((s) => ({ logs: [...s.logs, entry].slice(-500) })))
    }
    const logs = await api.getLogs()
    set({ logs })
  },
  clear: async () => {
    await api.clearLogs()
    set({ logs: [] })
  }
}))
