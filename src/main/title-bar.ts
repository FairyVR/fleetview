import type { ThemeId } from '@shared/ipc'

/**
 * Windows draws the minimise/maximise/close buttons itself even when the frame is hidden,
 * so it needs the palette handed to it per theme — otherwise light themes get white symbols
 * on white. Values mirror --bg-elev / --text in `index.css`; keep the two in sync.
 */
const PALETTE: Record<ThemeId, { color: string; symbolColor: string }> = {
  dark: { color: '#121826', symbolColor: '#e6ecf7' },
  midnight: { color: '#070b13', symbolColor: '#dbe4f5' },
  nebula: { color: '#171029', symbolColor: '#ece6fa' },
  aurora: { color: '#0c1c17', symbolColor: '#e2f2ec' },
  light: { color: '#ffffff', symbolColor: '#182034' },
  solar: { color: '#fffdf7', symbolColor: '#2c2617' }
}

/** Height of the app's header row, so the buttons line up with it exactly. */
export const TITLE_BAR_HEIGHT = 56

export function titleBarOverlayFor(theme: ThemeId): {
  color: string
  symbolColor: string
  height: number
} {
  return { ...(PALETTE[theme] ?? PALETTE.dark), height: TITLE_BAR_HEIGHT }
}
