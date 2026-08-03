/**
 * In-world board previews.
 *
 * Calibration works by painting every board slot a distinct flat colour in-game (see
 * `CALIBRATION_COLORS`), screenshotting the district, and dropping those shots in
 * `assets/board-calibration/`. This module segments such a shot: it finds each slot's
 * colour, records where that board sits in the image, and punches the coloured pixels
 * out to alpha so the screenshot becomes a cut-out overlay the real texture shows through.
 *
 * Pure logic only — the canvas/DOM side lives in `boardCalibration.ts`.
 */

/**
 * Slot N is painted CALIBRATION_COLORS[N] during a calibration pass — 20 fully saturated hues,
 * 18° apart around the wheel.
 *
 * Matching is by **hue**, not RGB distance, because the game does not render a texture at its
 * authored colour: lighting and bloom lighten and desaturate it. Measured on real district
 * shots, that wash moves a colour 50-70 units in RGB — far enough that `#FF8000` and `#FF8080`
 * become indistinguishable — while leaving hue within a few degrees. Half-brightness and
 * pastel entries are therefore useless here (they collapse onto their saturated siblings), as
 * are dark ones (`#000080` sits 20 from the starfield, closer than any real board).
 */
export const CALIBRATION_COLORS = [
  '#FF0000',
  '#FF9900',
  '#CCFF00',
  '#33FF00',
  '#00FF66',
  '#00FFFF',
  '#0066FF',
  '#3300FF',
  '#CC00FF',
  '#FF0099'
] as const

/**
 * A station has ten boards, so ten colours cover a calibration pass with 36° between them.
 *
 * That spacing is not generous, it is the minimum that works. At 18° a single board's own
 * lighting gradient dragged one end onto the neighbouring hue, and two surfaces of the *same*
 * board (a triboard's centre and its side panels) landed on different colours entirely.
 * Measured drift reaches a full 18°, so anything tighter than 36° misidentifies boards.
 */
export const BOARD_SLOT_COUNT = CALIBRATION_COLORS.length

/** Position within a calibration shot, as fractions of its width/height. */
export type Box = { x: number; y: number; w: number; h: number }

/** Degrees of hue a pixel may drift and still count as its calibration colour. Half the 36° spacing. */
export const DEFAULT_TOLERANCE = 18

/**
 * Below this chroma a pixel cannot *start* a board. Measured: a board's core sits at 0.41-0.49
 * even after the game's wash, while the pale panels that merely catch coloured light from a
 * board nearby reach only 0.28-0.31. Anything lower let one of those panels fuse onto a pennant
 * and drag the preview out across the wall behind it.
 *
 * A board's own washed-out end falls in that range too, and is lost. That is deliberate: every
 * attempt to recover it — a lower bar, a relaxed second pass, following the hue outwards — cost
 * more than it bought, up to merging two neighbouring boards into one.
 */
const MIN_SATURATION = 0.4

/** Bloom blows highlights to near-white and shadows to near-black; neither carries usable hue. */
const MIN_VALUE = 60
const MAX_VALUE = 250

/**
 * A board covers a real share of a wide district shot — the narrowest banner measured is ~0.9%.
 * Anything much smaller is a reflection, a distant prop, or bloom fringing.
 */
const MIN_BLOB_SHARE = 0.004

/**
 * Share of its own bounding box a blob must fill to be a board. Boards are rectangles, so even
 * a pillar across one leaves it well above half; the scenery that survives the colour match is
 * stringy — pipes, railings, light strips — and fills a fraction of its box.
 */
const MIN_FILL = 0.55

/**
 * A surface this elongated is not a board. Measured across every district: board faces run
 * 0.5-2.5 and pennants 0.20-0.26, while the floor strips and light rails that survive the colour
 * match reach 4-7. Rejecting them keeps the preview from painting a texture across the floor.
 */
const MAX_ASPECT = 3
const MIN_ASPECT = 0.1

/**
 * Share of a bounding-box edge line that must be filled for that line to belong to the board.
 *
 * A board sometimes touches a thin same-coloured sliver of scenery — the green strip running
 * along the foot of a window beyond the Driftball board — and the two flood-fill as one blob,
 * stretching the box across the window. The sliver gives itself away in the column profile: its
 * columns are ~6% filled, where even a narrow pennant hanging off the board's edge is ~76%.
 */
const MIN_EDGE_FILL = 0.08

/** Hue in degrees, or -1 when the pixel is too grey, too dark or too blown out to have one. */
export function hueOf(r: number, g: number, b: number, minSaturation: number = MIN_SATURATION): number {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const chroma = max - min
  if (max < MIN_VALUE || min > MAX_VALUE || !max || chroma / max < minSaturation) return -1

  let hue: number
  if (max === r) hue = ((g - b) / chroma) * 60
  else if (max === g) hue = ((b - r) / chroma + 2) * 60
  else hue = ((r - g) / chroma + 4) * 60
  return hue < 0 ? hue + 360 : hue
}

const PALETTE_HUES = CALIBRATION_COLORS.map((hex) =>
  hueOf(parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16))
)

/** Shortest way round the wheel between two hues. */
const hueGap = (a: number, b: number): number => {
  const d = Math.abs(a - b) % 360
  return d > 180 ? 360 - d : d
}

/** Nearest calibration slot for one pixel, or -1 if it is scenery. */
function classify(r: number, g: number, b: number, tolerance: number): number {
  const hue = hueOf(r, g, b)
  if (hue < 0) return -1
  let best = -1
  let bestGap = tolerance
  for (let i = 0; i < PALETTE_HUES.length; i++) {
    const gap = hueGap(hue, PALETTE_HUES[i])
    if (gap < bestGap) {
      bestGap = gap
      best = i
    }
  }
  return best
}

export type Segmentation = {
  /** Each board's surfaces as boxes, largest first. */
  boxes: Map<number, Box[]>
  /** Per pixel: which board owns it, or -1. Only pixels of accepted boards are owned. */
  owner: Int8Array
}

/**
 * Segment a calibration screenshot.
 *
 * Returns each board's surfaces as boxes, largest first — a board can legitimately own several
 * (the triboards' side panels and pennants), plus a per-pixel owner map. `pixels` is not
 * modified; call `punchBoard` to cut a board out of a copy.
 */
export function segmentCalibration(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  tolerance: number = DEFAULT_TOLERANCE
): Segmentation {
  const n = width * height
  const label = new Int8Array(n)

  for (let i = 0; i < n; i++) {
    const p = i * 4
    label[i] = pixels[p + 3] < 128 ? -1 : classify(pixels[p], pixels[p + 1], pixels[p + 2], tolerance)
  }

  const minBlob = Math.max(4, Math.floor(n * MIN_BLOB_SHARE))
  const seen = new Uint8Array(n)
  // Which connected component each pixel belongs to, so only accepted boards get punched out.
  // Ten hues 36° apart cover the whole wheel, so punching on colour alone would erase every
  // saturated pixel in the district and leave the screenshot looking black and white.
  const component = new Int32Array(n).fill(-1)
  let nextComponent = 0
  const blobs: Blob[] = []
  // ponytail: explicit stack flood fill — recursion blows up on a 2MP shot.
  const stack: number[] = []

  for (let start = 0; start < n; start++) {
    const slot = label[start]
    if (slot < 0 || seen[start]) continue
    const id = nextComponent++
    seen[start] = 1
    stack.push(start)
    let count = 0
    let minX = width
    let maxX = -1
    let minY = height
    let maxY = -1

    while (stack.length) {
      const i = stack.pop() as number
      const x = i % width
      const y = (i - x) / width
      component[i] = id
      count++
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y

      if (x > 0 && label[i - 1] === slot && !seen[i - 1]) (seen[i - 1] = 1), stack.push(i - 1)
      if (x < width - 1 && label[i + 1] === slot && !seen[i + 1]) (seen[i + 1] = 1), stack.push(i + 1)
      if (y > 0 && label[i - width] === slot && !seen[i - width]) (seen[i - width] = 1), stack.push(i - width)
      if (y < height - 1 && label[i + width] === slot && !seen[i + width])
        (seen[i + width] = 1), stack.push(i + width)
    }

    // Scenery that happens to match a calibration colour — pipes, light strips, distant props —
    // is either tiny or stringy. Boards are big and rectangular; both tests must pass.
    // Judged before merging: keeping scraps around so a board's hue-drifted end could rejoin it
    // let a scrap bridge the gap to the *next* board and fuse the two. Bounding the absorption
    // only moved the creep sideways. A board that ends up slightly short is the smaller price.
    if (count < minBlob || count / ((maxX - minX + 1) * (maxY - minY + 1)) < MIN_FILL) continue
    blobs.push({
      slot,
      count,
      components: [id],
      box: {
        x: minX / width,
        y: minY / height,
        w: (maxX - minX + 1) / width,
        h: (maxY - minY + 1) / height
      }
    })
  }

  const boxes = new Map<number, Box[]>()
  const slotOfComponent = new Map<number, number>()
  // Everything below is judged on the merged blob: a board is only whole once its hue-drifted
  // scraps and the pieces a pillar cut it into have been rejoined.
  for (const blob of mergeGradientSplits(blobs)) {
    const bx0 = Math.round(blob.box.x * width)
    const by0 = Math.round(blob.box.y * height)
    const bx1 = bx0 + Math.round(blob.box.w * width) - 1
    const by1 = by0 + Math.round(blob.box.h * height) - 1
    // Shed any thin sliver of scenery the blob reached into, then re-judge its shape.
    const trimmed = trimSparseEdges(component, blob.components, width, bx0, by0, bx1, by1)
    if (!trimmed || trimmed.count < minBlob) continue
    const box = {
      x: trimmed.minX / width,
      y: trimmed.minY / height,
      w: (trimmed.maxX - trimmed.minX + 1) / width,
      h: (trimmed.maxY - trimmed.minY + 1) / height
    }
    const aspect = boxAspect(box, width, height)
    if (aspect > MAX_ASPECT || aspect < MIN_ASPECT) continue

    boxes.set(blob.slot, [...(boxes.get(blob.slot) ?? []), growBox(box, width, height)])
    for (const id of blob.components) slotOfComponent.set(id, blob.slot)
  }

  // Only accepted boards get an owner; the rest of the district stays as photographed.
  const owner = new Int8Array(n).fill(-1)
  for (let i = 0; i < n; i++) {
    const slot = slotOfComponent.get(component[i])
    if (slot !== undefined) owner[i] = slot
  }

  for (const list of boxes.values()) list.sort((a, b) => b.w * b.h - a.w * a.h)
  return { boxes, owner }
}

/**
 * How far a board's silhouette is grown before cutting, as a share of its shorter side.
 *
 * A board fades to near-black at its edges, and those pixels are too dark to carry a hue, so
 * the matched region stops short of the real edge and leaves a dark rim around the texture.
 * Growing the silhouette covers the rim. It is deliberately *not* replaced by the bounding
 * rectangle: a pennant is a notched banner, not a rectangle, and squaring it off hangs texture
 * in mid-air beside the notch.
 */
const EDGE_GROW = 0.03
const MIN_GROW = 1
const MAX_GROW = 12

/**
 * How far past its matched pixels a board reaches, in pixels. The reported box is grown by this
 * much and the cut-out silhouette is dilated by it, so the hole and the rectangle the texture is
 * drawn into always agree — grow only one of them and the difference shows as a halo.
 */
export const growRadius = (boxW: number, boxH: number): number =>
  Math.min(MAX_GROW, Math.max(MIN_GROW, Math.round(Math.min(boxW, boxH) * EDGE_GROW)))

/**
 * Cut one board out of a frame, leaving every other board intact.
 *
 * Pixels owned by a *different* board are spared: boxes overlap (a promo board can sit inside
 * the box of the triboard behind it), and without that one board's texture would show through
 * its neighbour.
 */
export function punchBoard(
  pixels: Uint8ClampedArray,
  owner: Int8Array,
  slot: number,
  boxes: Box[],
  width: number,
  height: number
): void {
  for (const box of boxes) {
    const x0 = Math.max(0, Math.round(box.x * width))
    const y0 = Math.max(0, Math.round(box.y * height))
    const bw = Math.min(width - x0, Math.round(box.w * width))
    const bh = Math.min(height - y0, Math.round(box.h * height))
    if (bw <= 0 || bh <= 0) continue

    // A board face is a rectangle: cut the whole box, corners included. The board mesh rounds
    // them off and fades out there, so matching alone leaves crescents of calibration colour
    // around the texture. The box is not grown for a face, so this cannot reach the frame posts.
    if (surfaceKind(bw / bh) === 'face') {
      for (let y = 0; y < bh; y++) {
        for (let x = 0; x < bw; x++) {
          const i = (y0 + y) * width + x0 + x
          if (owner[i] === slot || owner[i] === -1) pixels[i * 4 + 3] = 0
        }
      }
      continue
    }

    // A pennant is a notched banner. Squaring it off hangs texture in mid-air beside the notch,
    // so cut its own outline, grown just enough to cover the edge falloff.
    const own = new Uint8Array(bw * bh)
    for (let y = 0; y < bh; y++) {
      for (let x = 0; x < bw; x++) {
        if (owner[(y0 + y) * width + x0 + x] === slot) own[y * bw + x] = 1
      }
    }
    const grown = dilate(own, bw, bh, growRadius(bw, bh))
    const enclosed = interiorHoles(own, bw, bh)

    // Clamped to the box, which segmentCalibration already grew by the same radius: the hole can
    // never reach past the rectangle the texture fills, so there is no halo at the edge.
    for (let y = 0; y < bh; y++) {
      for (let x = 0; x < bw; x++) {
        const m = y * bw + x
        if (!grown[m]) continue
        const i = (y0 + y) * width + x0 + x
        if (owner[i] === slot || owner[i] === -1 || enclosed[m]) pixels[i * 4 + 3] = 0
      }
    }
  }
}

/**
 * Gaps that the board completely surrounds — a specular highlight blown past `MAX_VALUE`, a
 * decal, a reflection. Found by flooding the unowned pixels inwards from the box edge: whatever
 * the flood cannot reach is enclosed, and belongs to the board.
 */
function interiorHoles(own: Uint8Array, w: number, h: number): Uint8Array {
  const outside = new Uint8Array(w * h)
  const stack: number[] = []
  const push = (i: number): void => {
    if (!own[i] && !outside[i]) {
      outside[i] = 1
      stack.push(i)
    }
  }
  for (let x = 0; x < w; x++) {
    push(x)
    push((h - 1) * w + x)
  }
  for (let y = 0; y < h; y++) {
    push(y * w)
    push(y * w + w - 1)
  }
  while (stack.length) {
    const i = stack.pop() as number
    const x = i % w
    const y = (i - x) / w
    if (x > 0) push(i - 1)
    if (x < w - 1) push(i + 1)
    if (y > 0) push(i - w)
    if (y < h - 1) push(i + w)
  }
  const enclosed = new Uint8Array(w * h)
  for (let i = 0; i < enclosed.length; i++) if (!own[i] && !outside[i]) enclosed[i] = 1
  return enclosed
}

/** Square dilation, done as two 1-D passes so the cost does not grow with the radius. */
function dilate(mask: Uint8Array, w: number, h: number, radius: number): Uint8Array {
  const pass = (src: Uint8Array, major: number, minor: number, step: number, jump: number): Uint8Array => {
    const dst = new Uint8Array(src.length)
    for (let a = 0; a < major; a++) {
      const base = a * jump
      let since = minor // distance since the last set pixel, scanning forward
      for (let b = 0; b < minor; b++) {
        const i = base + b * step
        since = src[i] ? 0 : since + 1
        if (since <= radius) dst[i] = 1
      }
      since = minor // and again backwards
      for (let b = minor - 1; b >= 0; b--) {
        const i = base + b * step
        since = src[i] ? 0 : since + 1
        if (since <= radius) dst[i] = 1
      }
    }
    return dst
  }
  return pass(pass(mask, h, w, 1, w), w, h, w, 1)
}

type Blob = { slot: number; count: number; box: Box; components: number[] }

/**
 * How close two pieces must be, as a share of the image, to count as one board. Wide enough to
 * bridge a pillar standing in front of a board (~1% of a 1080p district shot); the genuinely
 * separate surfaces of one board — its two side panels, its pennants — sit ten times further apart.
 */
const TOUCH_GAP = 0.02

/** How much of the shared edge must line up for a split to be a cut across one board. */
const ALIGN = 0.8

const touching = (a: Box, b: Box): boolean =>
  a.x < b.x + b.w + TOUCH_GAP &&
  b.x < a.x + a.w + TOUCH_GAP &&
  a.y < b.y + b.h + TOUCH_GAP &&
  b.y < a.y + a.h + TOUCH_GAP

const overlap = (a0: number, a1: number, b0: number, b1: number): number =>
  Math.max(0, Math.min(a1, b1) - Math.max(a0, b0))

/**
 * Whether two pieces look like one rectangle someone drew a line across — they must share
 * nearly all of one edge. A board split by its own lighting gives two pieces of the same width
 * stacked exactly; a board sitting against a same-hue floor does not.
 */
const alignedCut = (a: Box, b: Box): boolean =>
  overlap(a.x, a.x + a.w, b.x, b.x + b.w) >= ALIGN * Math.max(a.w, b.w) ||
  overlap(a.y, a.y + a.h, b.y, b.y + b.h) >= ALIGN * Math.max(a.h, b.h)

/**
 * Reach past the matched pixels to the board's true edge, the same distance the cut-out grows.
 *
 * Only pennants need it. A board face is cut as its whole bounding box, and growing that box
 * would push the hole onto the frame posts standing at the board's edge.
 */
function growBox(box: Box, width: number, height: number): Box {
  if (surfaceKind(boxAspect(box, width, height)) === 'face') return box
  const grow = growRadius(box.w * width, box.h * height)
  const x = Math.max(0, box.x - grow / width)
  const y = Math.max(0, box.y - grow / height)
  return {
    x,
    y,
    w: Math.min(1 - x, box.w + (box.x - x) + grow / width),
    h: Math.min(1 - y, box.h + (box.y - y) + grow / height)
  }
}

/**
 * Pull a blob's bounding box in past any sparsely filled edge line, so a thin sliver of scenery
 * the blob happens to touch does not stretch the box across it. Returns null if nothing survives.
 */
function trimSparseEdges(
  component: Int32Array,
  ids: number[],
  width: number,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number
): { minX: number; minY: number; maxX: number; maxY: number; count: number } | null {
  const owns = (i: number): boolean => ids.includes(component[i])
  const colFill = (x: number, y0: number, y1: number): number => {
    let hits = 0
    for (let y = y0; y <= y1; y++) if (owns(y * width + x)) hits++
    return hits / (y1 - y0 + 1)
  }
  const rowFill = (y: number, x0: number, x1: number): number => {
    let hits = 0
    for (let x = x0; x <= x1; x++) if (owns(y * width + x)) hits++
    return hits / (x1 - x0 + 1)
  }

  for (let shrinking = true; shrinking && minX <= maxX && minY <= maxY; ) {
    shrinking = false
    if (colFill(minX, minY, maxY) < MIN_EDGE_FILL) (minX++, (shrinking = true))
    if (maxX >= minX && colFill(maxX, minY, maxY) < MIN_EDGE_FILL) (maxX--, (shrinking = true))
    if (minY <= maxY && rowFill(minY, minX, maxX) < MIN_EDGE_FILL) (minY++, (shrinking = true))
    if (maxY >= minY && rowFill(maxY, minX, maxX) < MIN_EDGE_FILL) (maxY--, (shrinking = true))
  }
  if (minX > maxX || minY > maxY) return null

  let count = 0
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) if (owns(y * width + x)) count++
  }
  return { minX, minY, maxX, maxY, count }
}

/**
 * Rejoin a board that came back in pieces.
 *
 * Three things break one board into several blobs. Its own lighting: the rendered hue drifts far
 * enough across a face — the Driftball board runs 126° at one end against an authored 108° — that
 * one end lands on the neighbouring palette entry, so the pieces carry adjacent slot numbers.
 * A pillar standing in front of it, which splits it into pieces of the *same* slot. And both at
 * once. All are merged, but only when the pieces touch and share nearly all of one edge, which is
 * what tells a split board from two boards side by side. The larger piece names the result.
 */
function mergeGradientSplits(blobs: Blob[], slots = CALIBRATION_COLORS.length): Blob[] {
  const out = [...blobs]
  for (let merged = true; merged; ) {
    merged = false
    outer: for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        // Same board (a pillar cut it in two) or the neighbouring hue (its own lighting did).
        const gap = Math.abs(out[i].slot - out[j].slot)
        if (gap !== 0 && gap !== 1 && gap !== slots - 1) continue
        if (!touching(out[i].box, out[j].box) || !alignedCut(out[i].box, out[j].box)) continue

        const [big, small] = out[i].count >= out[j].count ? [out[i], out[j]] : [out[j], out[i]]
        const x = Math.min(big.box.x, small.box.x)
        const y = Math.min(big.box.y, small.box.y)
        out.splice(j, 1)
        out[i] = {
          slot: big.slot,
          count: big.count + small.count,
          components: [...big.components, ...small.components],
          box: {
            x,
            y,
            w: Math.max(big.box.x + big.box.w, small.box.x + small.box.w) - x,
            h: Math.max(big.box.y + big.box.h, small.box.y + small.box.h) - y
          }
        }
        merged = true
        break outer
      }
    }
  }
  return out
}

/**
 * One texture covers a whole board assembly: the top of the image is the board face and the
 * bottom strip is the flag flown on the pennants beside it. Measured from the reference
 * artwork — 1983×2049 overall, of which the bottom 1983×337 is the flag.
 */
export const FLAG_TEXTURE_SHARE = 337 / 2049

/**
 * Which surface of the assembly a detected box is.
 *
 * ponytail: told apart by shape alone — pennants measured 0.08-0.25 on-screen while the
 * narrowest board face measured 0.56, so the gap is wide and a single threshold holds. If a
 * district ever has a genuinely skinny face, give the calibration texture a marker instead.
 */
export function surfaceKind(aspect: number): 'face' | 'flag' {
  return aspect < 0.4 ? 'flag' : 'face'
}

/** The part of the texture a surface displays, as fractions of the image. */
export function textureCrop(kind: 'face' | 'flag'): Box {
  return kind === 'flag'
    ? { x: 0, y: 1 - FLAG_TEXTURE_SHARE, w: 1, h: FLAG_TEXTURE_SHARE }
    : { x: 0, y: 0, w: 1, h: 1 - FLAG_TEXTURE_SHARE }
}

/** The board's on-screen aspect ratio, used to spot textures that will be stretched. */
export function boxAspect(box: Box, imageWidth: number, imageHeight: number): number {
  return (box.w * imageWidth) / (box.h * imageHeight)
}

/**
 * Advisory only — the shot's viewing angle skews the measured aspect, so the tolerance is
 * wide and only a gross mismatch (a square logo on a billboard) is worth flagging.
 */
export function aspectVerdict(
  naturalWidth: number,
  naturalHeight: number,
  expectedAspect: number
): 'ok' | 'stretched' | 'unknown' {
  if (!naturalWidth || !naturalHeight || !expectedAspect || !Number.isFinite(expectedAspect)) return 'unknown'
  const ratio = naturalWidth / naturalHeight / expectedAspect
  return ratio < 0.75 || ratio > 1.333 ? 'stretched' : 'ok'
}

/** Textures far above the board's on-screen size are wasted download for every player. */
export function resolutionNote(naturalWidth: number, naturalHeight: number): string | null {
  const max = Math.max(naturalWidth, naturalHeight)
  return max > 4096 ? `${naturalWidth}×${naturalHeight} is oversized — 2048px is plenty` : null
}
