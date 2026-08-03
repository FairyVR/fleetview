/**
 * Loads the calibration screenshots in `assets/board-calibration/` and turns them into
 * per-slot in-world previews. Segmentation runs once in the renderer (the shots are local
 * assets, so the canvas is not tainted) and is cached for the app's lifetime.
 *
 * Drop nothing in that folder and everything here returns empty — Board Manager then falls
 * back to its flat thumbnail. See `boardPreview.ts` for the calibration colour map.
 */
import {
  segmentCalibration,
  boxAspect,
  punchBoard,
  surfaceKind,
  textureCrop,
  type Box
} from './boardPreview'
import { BOARD_SLOTS, boardIsInGame } from './boards'

const SHOTS = import.meta.glob('../assets/board-calibration/*.png', {
  eager: true,
  query: '?url',
  import: 'default'
}) as Record<string, string>

export type BoardPreview = {
  /** Screenshot the board was found in, for the UI to label overlapping views. */
  shot: string
  /** Object URL of that screenshot with every calibration colour punched out to alpha 0. */
  cutoutUrl: string
  /** Where this board sits in the shot, as fractions of its width/height. */
  box: Box
  /** On-screen width/height of the board, for the stretch lint. */
  aspect: number
  /** Board face, or the flag flown on a pennant beside it. */
  kind: 'face' | 'flag'
  /** The part of the texture this surface shows. */
  crop: Box
}

export const hasCalibration = (): boolean => Object.keys(SHOTS).length > 0

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Could not load calibration shot ${url}`))
    img.src = url
  })
}

const toObjectUrl = (canvas: HTMLCanvasElement): Promise<string> =>
  new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(URL.createObjectURL(blob)) : reject(new Error('Cut-out encoding failed'))),
      'image/png'
    )
  )

async function segmentShot(path: string, url: string): Promise<Array<[number, BoardPreview]>> {
  const shot = path.split('/').pop()?.replace(/\.png$/i, '') ?? path
  const img = await loadImage(url)
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('No 2d canvas context')
  ctx.drawImage(img, 0, 0)

  const frame = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const { boxes, owner } = segmentCalibration(frame.data, canvas.width, canvas.height)
  if (!boxes.size) return []

  const out: Array<[number, BoardPreview]> = []
  for (const [colorIndex, list] of boxes) {
    // A board the game never renders can only produce false positives — its colour matches
    // nothing but scenery. Drop them rather than let ambient lighting invent boards.
    // Calibration colour N was painted on board N of the dashboard list, whose config key is
    // BOARD_SLOTS[N] — the keys are not 0-9.
    const slot = BOARD_SLOTS[colorIndex]
    if (!boardIsInGame(slot)) continue

    // One cut-out per board, opening only its own rectangles — see punchBoard.
    const cut = new ImageData(new Uint8ClampedArray(frame.data), canvas.width, canvas.height)
    punchBoard(cut.data, owner, colorIndex, list, canvas.width, canvas.height)
    ctx.putImageData(cut, 0, 0)
    const cutoutUrl = await toObjectUrl(canvas)

    for (const box of list) {
      const aspect = boxAspect(box, canvas.width, canvas.height)
      const kind = surfaceKind(aspect)
      out.push([slot, { shot, cutoutUrl, box, aspect, kind, crop: textureCrop(kind) }])
    }
  }
  return out
}

let cache: Promise<Map<number, BoardPreview[]>> | null = null

/** Segments every calibration shot once; later calls reuse the same promise. */
export function loadBoardPreviews(): Promise<Map<number, BoardPreview[]>> {
  cache ??= (async () => {
    const bySlot = new Map<number, BoardPreview[]>()
    for (const [path, url] of Object.entries(SHOTS)) {
      try {
        for (const [slot, preview] of await segmentShot(path, url)) {
          bySlot.set(slot, [...(bySlot.get(slot) ?? []), preview])
        }
      } catch (err) {
        // A bad screenshot must not take the page down — the board just stays uncalibrated.
        console.error(`[board calibration] ${path}:`, err)
      }
    }
    return bySlot
  })()
  return cache
}
