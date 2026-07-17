import { create } from 'zustand'

/** Current fleet/station context, shared across station-scoped modules. */
interface SelectionState {
  fleetId: string | null
  fleetName: string | null
  stationId: string | null
  stationName: string | null
  selectFleet: (id: string | null, name?: string | null) => void
  selectStation: (id: string | null, name?: string | null) => void
}

export const useSelectionStore = create<SelectionState>((set) => ({
  fleetId: null,
  fleetName: null,
  stationId: null,
  stationName: null,
  selectFleet: (id, name) => set({ fleetId: id, fleetName: name ?? null, stationId: null, stationName: null }),
  selectStation: (id, name) => set({ stationId: id, stationName: name ?? null })
}))
