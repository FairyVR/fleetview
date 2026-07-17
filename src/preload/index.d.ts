import type { FleetViewApi } from '@shared/ipc'

declare global {
  interface Window {
    api: FleetViewApi
  }
}

export {}
