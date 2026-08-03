/**
 * Runs the renderer's real segmentation over the calibration screenshots and reports what it
 * found — which boards, where, and how confident. Node has no PNG decoder, so the pixels come
 * from a .raw dump written by scripts/dump-png.ps1 (uint32 width, uint32 height, then BGRA).
 *
 *   powershell -File scripts/dump-png.ps1
 *   npx tsx scripts/check-calibration.ts
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { CALIBRATION_COLORS, segmentCalibration } from '../src/renderer/src/lib/boardPreview'
import { BOARD_SLOTS, boardIsInGame, boardName } from '../src/renderer/src/lib/boards'

const DIR = 'src/renderer/src/assets/board-calibration'
const found = new Map<number, string[]>()
let shotCount = 0

const raws = existsSync(DIR) ? readdirSync(DIR).filter((f) => f.endsWith('.raw')) : []
if (!raws.length) {
  console.error(`No .raw dumps in ${DIR} — run: powershell -File scripts/dump-png.ps1`)
  process.exit(1)
}

for (const file of raws) {
  shotCount++
  const buf = readFileSync(join(DIR, file))
  const width = buf.readUInt32LE(0)
  const height = buf.readUInt32LE(4)
  const pixels = new Uint8ClampedArray(buf.subarray(8))
  // The dump is BGRA straight from GDI+; the segmenter expects canvas order.
  for (let i = 0; i < pixels.length; i += 4) {
    const b = pixels[i]
    pixels[i] = pixels[i + 2]
    pixels[i + 2] = b
  }

  console.log(`\n${file}  ${width}×${height}`)
  const { boxes } = segmentCalibration(pixels, width, height)
  if (!boxes.size) {
    console.log('  nothing found — wrong district, or the colours washed out past tolerance')
    continue
  }

  for (const [colorIndex, list] of [...boxes].sort((a, b) => a[0] - b[0])) {
    // Calibration colour N was painted on board N of the dashboard list, at config key
    // BOARD_SLOTS[N] — the keys are not 0-9.
    const slot = BOARD_SLOTS[colorIndex]
    if (!boardIsInGame(slot)) continue // nothing renders it; every hit is scenery
    for (const box of list) {
      const px = `${Math.round(box.w * width)}×${Math.round(box.h * height)}px`
      const at = `@${Math.round(box.x * width)},${Math.round(box.y * height)}`
      const aspect = (box.w * width) / (box.h * height)
      const share = box.w * box.h * 100
      // Anything enormous or wildly elongated is scenery, not a board — say so rather than
      // letting it sit in the list looking like a finding.
      const doubt = share > 20 || aspect > 4 ? '  ← suspect' : ''
      console.log(
        `  key ${String(slot).padStart(2)} ${CALIBRATION_COLORS[colorIndex]}  ${px.padEnd(11)} ${at.padEnd(11)} aspect ${aspect.toFixed(2).padStart(5)}  ${share.toFixed(1).padStart(4)}%  ${boardName(slot).name}${doubt}`
      )
    }
    found.set(slot, [...(found.get(slot) ?? []), file])
  }
}

const live = BOARD_SLOTS.filter(boardIsInGame)
const missing = live.filter((s) => !found.has(s))
console.log(`\nfound ${found.size}/${live.length} in-game boards across ${shotCount} shots`)
if (missing.length) {
  console.log(`missing: ${missing.map((s) => `key ${s} (${boardName(s).name})`).join(', ')}`)
}
