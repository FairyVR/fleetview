/**
 * Board texture slots live in station config as `config.stationConfig.BoardTextureUrlN`
 * (live-verified 2026-07-18). Names follow the official dashboard's board manager,
 * in its display order; slots beyond the list fall back to "Board N".
 */
export const BOARD_KEY_PREFIX = 'config.stationConfig.BoardTextureUrl'
export const BOARD_SECTION = 'District Information Boards'

export const BOARD_NAMES: Array<{ name: string; alt?: string }> = [
  { name: 'Landing pad triboard left: sides', alt: 'Driftplex east triboard: sides' },
  { name: 'Landing pad triboard left: center', alt: 'Driftplex east triboard: center' },
  { name: 'Driftball center: left' },
  { name: 'Driftball center: right' },
  { name: 'Driftball ramp triboard: sides', alt: 'Driftplex west triboard: sides' },
  { name: 'Driftball ramp triboard: center', alt: 'Driftplex west triboard: center' },
  { name: 'Driftball large promo board' },
  { name: 'Driftplex large promo boards' },
  { name: 'Driftplex lab front board' },
  { name: 'Club large promo board' }
]

export function boardName(slot: number): { name: string; alt?: string } {
  return BOARD_NAMES[slot] ?? { name: `Board ${slot}` }
}
