import { create } from 'zustand'

export type ToastTone = 'good' | 'bad' | 'info'

export interface Toast {
  id: number
  message: string
  tone: ToastTone
}

interface ToastState {
  toasts: Toast[]
  /** Show a toast. It clears itself after a few seconds. */
  push: (message: string, tone?: ToastTone) => void
  dismiss: (id: number) => void
}

let nextId = 0

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (message, tone = 'good') => {
    const id = ++nextId
    set((s) => ({ toasts: [...s.toasts, { id, message, tone }] }))
    setTimeout(() => get().dismiss(id), tone === 'bad' ? 6000 : 3500)
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
}))

/** Fire-and-forget helper so call sites don't have to touch the store. */
export const toast = (message: string, tone?: ToastTone): void =>
  useToastStore.getState().push(message, tone)
