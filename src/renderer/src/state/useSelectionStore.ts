import { create } from 'zustand'
import { api } from '../lib/api'

/** A fleet as the header switcher knows it, cached from one `fleet.list` call. */
export interface FleetOption {
  id: string
  name: string
  stations: { id: string; name: string }[]
}

/** Current fleet/station context, shared across station-scoped modules. */
interface SelectionState {
  fleetId: string | null
  fleetName: string | null
  stationId: string | null
  stationName: string | null
  /** Fleets + their stations, filled by the header switcher so pages don't refetch. */
  fleets: FleetOption[]
  selectFleet: (id: string | null, name?: string | null) => void
  selectStation: (id: string | null, name?: string | null) => void
  setFleets: (fleets: FleetOption[]) => void
  /** Restore the last context from persisted settings. Called once at startup. */
  hydrate: () => Promise<void>
}

export const useSelectionStore = create<SelectionState>((set) => ({
  fleetId: null,
  fleetName: null,
  stationId: null,
  stationName: null,
  fleets: [],

  selectFleet: (id, name) => {
    set({ fleetId: id, fleetName: name ?? null, stationId: null, stationName: null })
    // Persisted so station-scoped pages work straight after a restart. Fire-and-forget:
    // failing to remember the selection must never block using it.
    void api.setSettings({
      lastFleetId: id,
      lastFleetName: name ?? null,
      lastStationId: null,
      lastStationName: null
    })
  },

  selectStation: (id, name) => {
    set({ stationId: id, stationName: name ?? null })
    void api.setSettings({ lastStationId: id, lastStationName: name ?? null })
  },

  setFleets: (fleets) => set({ fleets }),

  hydrate: async () => {
    const s = await api.getSettings()
    set({
      fleetId: s.lastFleetId ?? null,
      fleetName: s.lastFleetName ?? null,
      stationId: s.lastStationId ?? null,
      stationName: s.lastStationName ?? null
    })
  }
}))
