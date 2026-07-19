/**
 * Classification of station-config keys, driving which editor surface shows each key.
 * Grounded in live config from station d27f9911 (Strike fleet), 2026-07-18.
 */

export type KeyClass =
  | { kind: 'hidden' }
  | { kind: 'gamemode'; gm: string; field: string }
  | { kind: 'config' }

const GM_RE = /^loadedgamemodes\.(.+)\.modulestate\.dashboardconfigoverrides\.(.+)$/i

export function classifyKey(key: string): KeyClass {
  // LE strings aren't human-editable; colors can't be changed per station;
  // board URLs belong to the Board Manager.
  if (/^CustomGamemodes\./i.test(key)) return { kind: 'hidden' }
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
  { field: 'maxteamsize', type: 'number' }
]
