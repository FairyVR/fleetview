/**
 * Board texture slots live in station config as `config.stationConfig.BoardTextureUrlN`
 * (live-verified 2026-07-18).
 *
 * A station has ten boards, and they are **not** keys 0-9: they sit at the scattered indices in
 * `slot` below, confirmed two ways — the official dashboard's board manager reads exactly those
 * keys, and they are the only ones a real station had set. The gaps (0-2, 9, 11, 15-19) exist in
 * the config but drive nothing.
 *
 * One board can render on several surfaces at once — a "sides" board is two panels plus the
 * pennants beside them — and the same board appears in more than one district under the `alt`
 * name. See `boardPreview.ts` for how one texture is divided across those surfaces.
 */
export const BOARD_KEY_PREFIX = 'config.stationConfig.BoardTextureUrl'
export const BOARD_SECTION = 'District Information Boards'

export const BOARD_NAMES: Array<{ slot: number; name: string; alt?: string; inGame?: false }> = [
  { slot: 3, name: 'Landing pad triboard left: sides', alt: 'Driftplex east triboard: sides' },
  { slot: 4, name: 'Landing pad triboard left: center', alt: 'Driftplex east triboard: center' },
  { slot: 5, name: 'Driftball center: left' },
  { slot: 6, name: 'Driftball center: right' },
  { slot: 7, name: 'Driftball ramp triboard: sides', alt: 'Driftplex west triboard: sides' },
  { slot: 8, name: 'Driftball ramp triboard: center', alt: 'Driftplex west triboard: center' },
  { slot: 10, name: 'Driftball large promo board' },
  // The dashboard offers these three, but nothing in the game reads them — a calibration pass
  // painted all ten and only these never appeared in any district. Setting them does nothing.
  { slot: 12, name: 'Driftplex large promo boards', inGame: false },
  { slot: 13, name: 'Driftplex lab front board', inGame: false },
  { slot: 14, name: 'Club large promo board', inGame: false }
]

/** Config key indices of the real boards, in the dashboard's display order. */
export const BOARD_SLOTS = BOARD_NAMES.map((b) => b.slot)

/** True when the game actually renders this board somewhere. */
export const boardIsInGame = (slot: number): boolean =>
  BOARD_NAMES.find((b) => b.slot === slot)?.inGame !== false

export function boardName(slot: number): { name: string; alt?: string } {
  return BOARD_NAMES.find((b) => b.slot === slot) ?? { name: `Board ${slot}` }
}
