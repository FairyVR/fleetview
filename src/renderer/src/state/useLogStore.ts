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
    const logs = await api.getLogs()
    set({ logs })
    if (!get().subscribed) {
      api.onLog((entry) => set((s) => ({ logs: [...s.logs, entry].slice(-500) })))
      set({ subscribed: true })
    }
  },
  clear: async () => {
    await api.clearLogs()
    set({ logs: [] })
  }
}))
