/**
 * Player-facing arena names for gamemode ids found in station config
 * (`loadedgamemodes.<id>.…`). Ids appear with inconsistent casing in live configs
 * (`1200_full_2` and `1200_Full_2` both exist) — always look up lowercased.
 * Provided by the fleet operator; extend freely.
 */
export const GAMEMODE_GROUPS: Record<string, Record<string, string>> = {
  TKB: {
    tkb_prime: 'Prime Arena',
    tkb_bunker: 'Bunker',
    tkb_fieldhousewest: 'Fieldhouse West',
    tkb_fieldhouseeast: 'Fieldhouse East',
    tkb_plazaeast: 'Plaza East'
  },
  Driftball: {
    'driftball east 01': 'Front East 4v4 Arena',
    'driftball east 02': 'Back East 4v4 Arena',
    'driftball west 01': 'Front West 4v4 Arena',
    'driftball west 02': 'Back West 4v4 Arena',
    'driftball halfg': 'HalfG 3v3 Arena'
  },
  Driftblitz: {
    driftplexsoccerwestfront: 'Front Driftblitz Arena',
    driftplexsoccerwestback: 'Back Driftblitz Arena'
  },
  'Z Drift': {
    zdrift_01: 'Left Z Drift Arena',
    zdriftgamejam1: 'Center Z Drift Arena',
    zdrift_02: 'Right Z Drift Arena'
  }
}

/** Config ids mix separators freely (`fieldhouse 03` vs `fieldhouse_03`) — normalize both sides. */
const norm = (id: string): string => id.toLowerCase().replace(/[\s_]+/g, '_')

const FLAT: Record<string, string> = Object.fromEntries(
  Object.values(GAMEMODE_GROUPS).flatMap((ids) => Object.entries(ids).map(([k, v]) => [norm(k), v]))
)
const GROUP_OF: Record<string, string> = Object.fromEntries(
  Object.entries(GAMEMODE_GROUPS).flatMap(([group, ids]) => Object.keys(ids).map((id) => [norm(id), group]))
)

/** Human name for a gamemode id; unknown ids get a cleaned-up fallback. */
export function gamemodeDisplayName(id: string): string {
  return FLAT[norm(id)] ?? id.replace(/_/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Group name for a gamemode id, or null when unmapped. */
export function gamemodeGroup(id: string): string | null {
  return GROUP_OF[norm(id)] ?? null
}
