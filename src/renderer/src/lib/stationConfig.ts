/**
 * Classification of station-config keys, driving which editor surface shows each key.
 * Grounded in live config from station d27f9911 (Strike fleet), 2026-07-18.
 */

import { normalizeGamemodeId } from './gamemodes'

export type KeyClass =
  | { kind: 'hidden' }
  | { kind: 'gamemode'; gm: string; field: string }
  | { kind: 'config' }

const GM_RE = /^loadedgamemodes\.(.+)\.modulestate\.dashboardconfigoverrides\.(.+)$/i

export function classifyKey(key: string): KeyClass {
  // LE strings aren't human-editable; colors can't be changed per station;
  // board URLs belong to the Board Manager.
  if (/^CustomGamemodes\./i.test(key)) return { kind: 'hidden' }
  // PushOffSpeed netvars are edited only from the Danger Zone System page.
  if (/^pushoffspeed(key|value)[1-4]$/i.test(key)) return { kind: 'hidden' }
  if (key === 'primary_color' || key === 'secondary_color') return { kind: 'hidden' }
  if (key.startsWith('config.stationConfig.BoardTextureUrl')) return { kind: 'hidden' }
  const m = GM_RE.exec(key)
  if (m) return { kind: 'gamemode', gm: m[1], field: m[2] }
  return { kind: 'config' }
}

/** Config keys always shown in the editor, even when the fetched config lacks them. */
export const PINNED_KEYS: Array<{ key: string; type: 'boolean' | 'number' }> = [
  { key: 'is_whitelist', type: 'boolean' },
  { key: 'is_public', type: 'boolean' },
  { key: 'config.spawnPointSettings.overrideSpawnPoint', type: 'boolean' },
  { key: 'config.spawnPointSettings.overriddenSpawnLocationX', type: 'number' },
  { key: 'config.spawnPointSettings.overriddenSpawnLocationY', type: 'number' },
  { key: 'config.spawnPointSettings.overriddenSpawnLocationZ', type: 'number' },
  { key: 'config.spawnPointSettings.overriddenSpawnRotationYaw', type: 'number' },
  { key: 'config.spawnPointSettings.overriddenSpawnRotationPitch', type: 'number' },
  { key: 'config.spawnPointSettings.overriddenSpawnRotationRoll', type: 'number' }
]

/** Infer a typed value from free-text input: true/false → boolean, numeric → number. */
export function coerceValue(text: string): unknown {
  const t = text.trim()
  if (t === 'true') return true
  if (t === 'false') return false
  if (t !== '' && !Number.isNaN(Number(t))) return Number(t)
  return text
}

/** Build the full override key for a gamemode field. */
export function gamemodeKey(gm: string, field: string): string {
  return `loadedgamemodes.${gm}.modulestate.dashboardconfigoverrides.${field}`
}

/**
 * The live config-write shape, verified from the working StrikeTournamentTool bot:
 * POST a FLAT dotted-key map (no `config` wrapper), ALL values as strings, only the
 * changed keys, with these query params. Anything else 422s.
 */
export const CONFIG_WRITE_PARAMS = { include_fleet_config: true, include_event_config: false }

/**
 * Keys present in the original config but missing from the edit. The POST write is a
 * partial update and cannot delete keys — callers must send these to the DELETE
 * endpoint (`station.config.delete`, body = array of key names) instead.
 */
export function configRemovedKeys(
  original: Record<string, unknown>,
  edited: Record<string, unknown>
): string[] {
  return Object.keys(original).filter((k) => !(k in edited))
}

export function configDiff(
  original: Record<string, unknown>,
  edited: Record<string, unknown>
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(edited)) {
    if (v === undefined) continue
    if (JSON.stringify(original[k]) !== JSON.stringify(v)) out[k] = String(v)
  }
  return out
}

/**
 * Every dashboardconfigoverrides field the dashboard exposes, so operators can set
 * them from typed controls without typing key names. Types drive the input widget.
 */
export const DEFAULT_GM_FIELDS: Array<{ field: string; type: 'boolean' | 'number' | 'string' }> = [
  { field: 'bkicklosingteam', type: 'boolean' },
  { field: 'buseclosedteamvoip', type: 'boolean' },
  { field: 'matchlengthseconds', type: 'number' },
  { field: 'mercyscoredifference', type: 'number' },
  { field: 'buseteam0whitelist', type: 'boolean' },
  { field: 'team0whitelist', type: 'string' },
  { field: 'buseteam1whitelist', type: 'boolean' },
  { field: 'team1whitelist', type: 'string' },
  { field: 'busebestof', type: 'boolean' },
  { field: 'roundspermatch', type: 'number' },
  { field: 'ticketmanagersettings.maxteamsizes.0', type: 'number' },
  { field: 'ticketmanagersettings.maxteamsizes.1', type: 'number' },
  { field: 'team0name', type: 'string' },
  { field: 'team1name', type: 'string' },
  { field: 'timebetweenrounds', type: 'number' },
  { field: 'bshuffleteamsaftermatch', type: 'boolean' },
  { field: 'ballowpracticemode', type: 'boolean' },
  { field: 'ballowrestarts', type: 'boolean' },
  { field: 'buserollbacknetcode', type: 'boolean' },
  { field: 'ballowplayergrabbingsameteam', type: 'boolean' },
  { field: 'ballowplayergrabbingotherteam', type: 'boolean' },
  { field: 'ballowplayertackling', type: 'boolean' },
  { field: 'busemaxteamsize', type: 'boolean' },
  { field: 'maxteamsize', type: 'number' },
  { field: 'team0imageurl', type: 'string' },
  { field: 'team1imageurl', type: 'string' },
  { field: 'regrabconfig.regrabspeedkey1', type: 'number' },
  { field: 'regrabconfig.regrabspeedkey2', type: 'number' },
  { field: 'regrabconfig.regrabspeedkey3', type: 'number' },
  { field: 'regrabconfig.regrabspeedkey4', type: 'number' },
  { field: 'regrabconfig.regrabspeedvalue1', type: 'number' },
  { field: 'regrabconfig.regrabspeedvalue2', type: 'number' },
  { field: 'regrabconfig.regrabspeedvalue3', type: 'number' },
  { field: 'regrabconfig.regrabspeedvalue4', type: 'number' }
]

/**
 * Values an arena runs with when it has no override for a field, from the fleet operator.
 * Shared across all arenas except team size, which differs by arena family. String fields
 * (team names, whitelists, image URLs) have no meaningful default and are omitted.
 */
const GM_DEFAULTS_BASE: Record<string, unknown> = {
  bkicklosingteam: false,
  buseclosedteamvoip: false,
  matchlengthseconds: 300,
  mercyscoredifference: 6,
  buseteam0whitelist: false,
  buseteam1whitelist: false,
  busebestof: false,
  roundspermatch: 1,
  timebetweenrounds: 45,
  bshuffleteamsaftermatch: false,
  ballowpracticemode: true,
  ballowrestarts: false,
  buserollbacknetcode: true,
  ballowplayergrabbingsameteam: true,
  ballowplayergrabbingotherteam: true,
  ballowplayertackling: true,
  'regrabconfig.regrabspeedkey1': 4,
  'regrabconfig.regrabspeedkey2': 10.5,
  'regrabconfig.regrabspeedkey3': 13,
  'regrabconfig.regrabspeedkey4': 13.010000228881836,
  'regrabconfig.regrabspeedvalue1': 4,
  'regrabconfig.regrabspeedvalue2': 2,
  'regrabconfig.regrabspeedvalue3': 1,
  'regrabconfig.regrabspeedvalue4': 0
}

/** Team size an arena defaults to: tkb arenas play 3v3, driftball 4v4 arenas play 4v4. */
function defaultTeamSize(gmId: string): number | undefined {
  const n = normalizeGamemodeId(gmId)
  if (n.startsWith('tkb')) return 3
  if (/^driftball_(east|west)_0[12]$/.test(n)) return 4
  return undefined
}

/** Default value for a gamemode override field on a given arena, or undefined when unknown. */
export function gamemodeFieldDefault(gmId: string, field: string): unknown {
  if (field === 'ticketmanagersettings.maxteamsizes.0' || field === 'ticketmanagersettings.maxteamsizes.1')
    return defaultTeamSize(gmId)
  return GM_DEFAULTS_BASE[field]
}
