/**
 * Player-facing arena names for gamemode ids found in station config
 * (`loadedgamemodes.<id>.…`). Ids appear with inconsistent casing in live configs
 * (`1200_full_2` and `1200_Full_2` both exist) — always look up lowercased.
 * Provided by the fleet operator; extend freely.
 */
export const GAMEMODE_GROUPS: Record<string, Record<string, string>> = {
  'Strike Arenas': {
    '0800_full_4': 'Farthest Back Left Strike Arena',
    '0800_full_2': 'Farthest Back Right Strike Arena',
    '1200_full_weekly_race': '1st 1v1 Strike Arena',
    '0800_full_3': '2nd 1v1 Strike Arena',
    '1200_full_4': 'First 3v3 Strike Arena',
    '1200_full_2': 'First 2v2 Strike Arena',
    '0800_full_1': 'Third 2v2 Strike Arena',
    '1200_full_3': 'Second 2v2 Strike Arena'
  },
  Fieldhouse: {
    'fieldhouse 03': 'First Strike Arena on the Right',
    'fieldhouse 04': 'First Strike Arena on the Left',
    'fieldhouse 05': 'Back Right Strike Arena',
    'fieldhouse 06': 'Back Left Strike Arena'
  },
  TKB: {
    tkb_plazaeast: 'Plaza East',
    tkb_plazawest: 'Plaza West',
    tkb_prime: 'Prime Arena',
    tkb_fieldhouseeast: 'Fieldhouse East',
    tkb_fieldhousewest: 'Fieldhouse West',
    tkb_bunker: 'Bunker'
  },
  'Driftball 4v4': {
    'driftball east 01': 'East Front 4v4 Arena',
    'driftball east 02': 'East Back 4v4 Arena',
    'driftball west 01': 'West Front 4v4 Arena',
    'driftball west 02': 'West Back 4v4 Arena'
  },
  'Z Drift': {
    zdrift_01: 'Left Z Drift',
    zdriftgamejam1: 'Middle Z Drift',
    zdrift_02: 'Right Z Drift'
  },
  Driftblitz: {
    driftplexsoccerwestback: 'Back Driftblitz',
    driftplexsoccerwestfront: 'Front Driftblitz',
    soccerhalfg: 'Half G Driftblitz'
  }
}

const FLAT: Record<string, string> = Object.assign({}, ...Object.values(GAMEMODE_GROUPS))
const GROUP_OF: Record<string, string> = Object.fromEntries(
  Object.entries(GAMEMODE_GROUPS).flatMap(([group, ids]) => Object.keys(ids).map((id) => [id, group]))
)

/** Human name for a gamemode id; unknown ids get a cleaned-up fallback. */
export function gamemodeDisplayName(id: string): string {
  return FLAT[id.toLowerCase()] ?? id.replace(/_/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Group name for a gamemode id, or null when unmapped. */
export function gamemodeGroup(id: string): string | null {
  return GROUP_OF[id.toLowerCase()] ?? null
}
