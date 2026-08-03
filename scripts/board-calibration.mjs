/**
 * Board calibration driver — paints every board slot on a station a distinct flat colour so
 * the district can be screenshotted for `src/renderer/src/assets/board-calibration/`.
 * See `src/renderer/src/lib/boardPreview.ts` for the colour → slot map.
 *
 *   node scripts/board-calibration.mjs <key-file> <station-name> inspect
 *   node scripts/board-calibration.mjs <key-file> <station-name> apply
 *   node scripts/board-calibration.mjs <key-file> <station-name> restore
 *
 * `apply` snapshots the station's current board URLs to scripts/.board-snapshot.json first;
 * `restore` puts them back, deleting the slots that were unset rather than blanking them.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const [keyFile, stationName, mode = 'inspect'] = process.argv.slice(2)
if (!keyFile || !stationName) {
  console.error('usage: node scripts/board-calibration.mjs <key-file> <station-name> [inspect|apply|restore]')
  process.exit(2)
}

const KEY = readFileSync(keyFile, 'utf8').trim()
const SNAP = join(dirname(fileURLToPath(import.meta.url)), '.board-snapshot.json')
const BASE = 'https://api.oriondrift.net'
const PREFIX = 'config.stationConfig.BoardTextureUrl'
// Mirrors CALIBRATION_COLORS in src/renderer/src/lib/boardPreview.ts — keep the two in step.
const COLORS = ['ff0000', 'ff9900', 'ccff00', '33ff00', '00ff66', '00ffff', '0066ff', '3300ff', 'cc00ff', 'ff0099']
// Mirrors BOARD_NAMES in src/renderer/src/lib/boards.ts: the ten real boards, in dashboard order.
// They are NOT keys 0-9 — the other BoardTextureUrl keys exist in the config but drive nothing.
const SLOTS = [3, 4, 5, 6, 7, 8, 10, 12, 13, 14]
const swatch = (hex) => `https://placehold.co/1024x512/${hex}/${hex}.png`

async function call(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'x-api-key': KEY, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${text.slice(0, 300)}`)
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

async function findStation(name) {
  const fleets = await call('GET', '/v2/fleets?include_stations=true')
  const items = Array.isArray(fleets) ? fleets : (fleets.items ?? [])
  const stations = items.flatMap((f) => (f.stations ?? []).map((s) => ({ ...s, fleet_name: f.fleet_name })))
  const wanted = name.trim().toLowerCase().replace(/[\s_]+/g, '')
  const hit = stations.find((s) => String(s.station_name).trim().toLowerCase().replace(/[\s_]+/g, '') === wanted)
  if (!hit) {
    console.error(`No station named "${name}". Available:`)
    for (const s of stations) console.error(`  ${s.fleet_name} / ${s.station_name}`)
    process.exit(1)
  }
  return hit
}

/** Current board URLs, keyed by full config key. The config may or may not be wrapped. */
async function readBoards(stationId) {
  const cfg = await call('GET', `/v2/stations/${stationId}/config`)
  const flat = cfg && typeof cfg.config === 'object' && cfg.config !== null ? cfg.config : cfg
  return Object.fromEntries(Object.entries(flat).filter(([k]) => k.startsWith(PREFIX)))
}

const station = await findStation(stationName)
console.log(`station: ${station.fleet_name} / ${station.station_name} (${station.station_id})`)

const current = await readBoards(station.station_id)
console.log('current boards:')
for (const i of SLOTS) console.log(`  ${String(i).padStart(2)}: ${current[PREFIX + i] ?? '(unset)'}`)

if (mode === 'apply') {
  // Never clobber an existing snapshot: a second apply would capture the calibration colours
  // themselves as the "original", and restore would then paint them back on permanently.
  if (existsSync(SNAP)) {
    console.log(`\nkeeping existing snapshot at ${SNAP} (delete it to re-snapshot)`)
  } else {
    writeFileSync(SNAP, JSON.stringify({ station, current }, null, 2))
    console.log(`\nsnapshot → ${SNAP}`)
  }
  const patch = Object.fromEntries(SLOTS.map((slot, i) => [PREFIX + slot, swatch(COLORS[i])]))
  await call('POST', `/v2/stations/${station.station_id}/config`, patch)
  console.log(`painted all ${SLOTS.length} boards.`)
} else if (mode === 'restore') {
  if (!existsSync(SNAP)) throw new Error(`no snapshot at ${SNAP} — nothing to restore`)
  const { current: before } = JSON.parse(readFileSync(SNAP, 'utf8'))
  const keys = SLOTS.map((i) => PREFIX + i)
  const patch = Object.fromEntries(keys.filter((k) => before[k]).map((k) => [k, before[k]]))
  // Slots that were unset must be deleted — writing "" is not the same as having no override.
  const drop = keys.filter((k) => !before[k])
  if (Object.keys(patch).length) await call('POST', `/v2/stations/${station.station_id}/config`, patch)
  if (drop.length) await call('DELETE', `/v2/stations/${station.station_id}/config`, drop)
  console.log(`restored ${Object.keys(patch).length} board(s), cleared ${drop.length}.`)
}
