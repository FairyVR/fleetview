import { describe, expect, it } from 'vitest'
import {
  BOARD_SLOT_COUNT,
  CALIBRATION_COLORS,
  DEFAULT_TOLERANCE,
  aspectVerdict,
  boxAspect,
  hueOf,
  resolutionNote,
  punchBoard,
  segmentCalibration,
  surfaceKind,
  textureCrop
} from '../src/renderer/src/lib/boardPreview'
import { BOARD_SLOTS } from '../src/renderer/src/lib/boards'

const W = 100
const H = 100

/** Opaque black canvas — nothing in it is close to any calibration colour. */
function blank(): Uint8ClampedArray {
  const px = new Uint8ClampedArray(W * H * 4)
  for (let i = 3; i < px.length; i += 4) px[i] = 255
  return px
}

function fill(px: Uint8ClampedArray, hex: string, x0: number, y0: number, w: number, h: number): void {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      const p = (y * W + x) * 4
      px[p] = r
      px[p + 1] = g
      px[p + 2] = b
      px[p + 3] = 255
    }
  }
}

const alphaAt = (px: Uint8ClampedArray, x: number, y: number): number => px[(y * W + x) * 4 + 3]
const ownerAt = (o: Int8Array, x: number, y: number): number => o[y * W + x]

describe('CALIBRATION_COLORS', () => {
  const rgb = (hex: string): [number, number, number] =>
    [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number]

  it('keeps every hue further apart than the tolerance, so no board can claim another', () => {
    const hues = CALIBRATION_COLORS.map((h) => hueOf(...rgb(h)))
    let closest = Infinity
    for (let i = 0; i < hues.length; i++) {
      for (let j = i + 1; j < hues.length; j++) {
        const gap = Math.abs(hues[i] - hues[j]) % 360
        closest = Math.min(closest, gap > 180 ? 360 - gap : gap)
      }
    }
    expect(closest).toBeGreaterThan(DEFAULT_TOLERANCE * 2 - 1)
  })

  it('is fully saturated throughout — the wash destroys pastels and darks', () => {
    for (const hex of CALIBRATION_COLORS) {
      const c = rgb(hex)
      expect(Math.max(...c)).toBe(255)
      expect(Math.min(...c)).toBe(0)
    }
  })

  it('has one colour per real board', () => {
    expect(CALIBRATION_COLORS).toHaveLength(BOARD_SLOT_COUNT)
    expect(BOARD_SLOT_COUNT).toBe(BOARD_SLOTS.length)
  })
})

describe('hueOf', () => {
  it('refuses greys, near-black and blown-out highlights — no usable hue in any of them', () => {
    expect(hueOf(128, 128, 128)).toBe(-1)
    expect(hueOf(10, 12, 14)).toBe(-1)
    expect(hueOf(253, 254, 255)).toBe(-1)
  })

  it('survives the wash the game applies', () => {
    // Real samples: a #00FFFF board rendered as #6BDADA, a #FF9900-family board as #DC9D67.
    expect(hueOf(0x6b, 0xda, 0xda)).toBeCloseTo(180, 0)
    expect(Math.abs(hueOf(0xdc, 0x9d, 0x67) - 36)).toBeLessThan(9)
  })
})

describe('segmentCalibration', () => {
  it('finds nothing in a shot with no calibration colours', () => {
    expect(segmentCalibration(blank(), W, H).boxes.size).toBe(0)
  })

  it('locates a board and reports its box as fractions of the image', () => {
    const px = blank()
    fill(px, CALIBRATION_COLORS[3], 20, 10, 40, 20)

    const boxes = segmentCalibration(px, W, H).boxes
    expect([...boxes.keys()]).toEqual([3])
    expect(boxes.get(3)).toEqual([{ x: 0.2, y: 0.1, w: 0.4, h: 0.2 }])
  })

  it('marks the board pixels as owned and leaves scenery unowned', () => {
    const px = blank()
    fill(px, CALIBRATION_COLORS[0], 20, 10, 40, 20)

    const { owner } = segmentCalibration(px, W, H)
    expect(ownerAt(owner, 30, 15)).toBe(0)
    expect(ownerAt(owner, 5, 5)).toBe(-1)
  })

  it('keeps every surface of a multi-board slot, largest first', () => {
    const px = blank()
    fill(px, CALIBRATION_COLORS[7], 5, 5, 10, 10)
    fill(px, CALIBRATION_COLORS[7], 50, 50, 30, 20)

    const boxes = segmentCalibration(px, W, H).boxes
    expect(boxes.get(7)).toHaveLength(2)
    expect(boxes.get(7)?.[0]).toMatchObject({ x: 0.5, y: 0.5 })
  })

  it('separates two different slots in one shot', () => {
    const px = blank()
    fill(px, CALIBRATION_COLORS[1], 0, 0, 20, 20)
    fill(px, CALIBRATION_COLORS[8], 60, 60, 20, 20)

    expect([...segmentCalibration(px, W, H).boxes.keys()].sort()).toEqual([1, 8])
  })

  it('tolerates the wash the game applies to a texture, but ignores specks', () => {
    const px = blank()
    fill(px, '#6BDADA', 20, 10, 40, 20) // colour 5 (#00FFFF) as the game actually renders it
    fill(px, CALIBRATION_COLORS[5], 90, 90, 1, 1) // a single stray pixel

    const boxes = segmentCalibration(px, W, H).boxes
    expect([...boxes.keys()]).toEqual([5])
  })

  it('rejects stringy scenery that happens to match a calibration colour', () => {
    const px = blank()
    // A light strip: spans a big bounding box but fills almost none of it.
    for (let y = 10; y < 60; y++) fill(px, CALIBRATION_COLORS[2], 10 + y, y, 3, 1)

    expect(segmentCalibration(px, W, H).boxes.size).toBe(0)
  })

  it('leaves rejected scenery opaque — only accepted boards become holes', () => {
    const px = blank()
    fill(px, CALIBRATION_COLORS[0], 20, 10, 40, 20) // a board
    // A long coloured light strip — plenty of pixels, but far too stringy to be a board.
    for (let y = 60; y < 95; y++) fill(px, CALIBRATION_COLORS[4], 5 + y - 60, y, 3, 1)

    const { boxes, owner } = segmentCalibration(px, W, H)
    punchBoard(px, owner, 0, boxes.get(0) ?? [], W, H)
    expect(alphaAt(px, 30, 15)).toBe(0) // board punched
    expect(alphaAt(px, 6, 61)).toBe(255) // light strip untouched
  })

  it('punches one board without opening a neighbour whose box overlaps it', () => {
    const px = blank()
    // Measured in shot3: board 8's box spans board 10 entirely. Cutting out 8 must not
    // reveal 10, or 8's texture shows through where board 10 actually is.
    fill(px, CALIBRATION_COLORS[0], 10, 10, 60, 60) // board A
    fill(px, CALIBRATION_COLORS[5], 30, 30, 20, 20) // board B, in front of A

    const { boxes, owner } = segmentCalibration(px, W, H)
    expect(boxes.get(0)).toBeDefined()
    expect(boxes.get(5)).toBeDefined()

    punchBoard(px, owner, 0, boxes.get(0) ?? [], W, H)
    expect(alphaAt(px, 15, 15)).toBe(0) // board A open
    expect(alphaAt(px, 40, 40)).toBe(255) // board B still sealed
  })

  it('rejoins a board that a pillar cuts across', () => {
    const px = blank()
    fill(px, CALIBRATION_COLORS[6], 20, 20, 40, 40)
    fill(px, '#282828', 39, 20, 1, 40) // pillar standing in front of it

    const boxes = segmentCalibration(px, W, H).boxes
    // One board, not two — otherwise the texture would be drawn twice, once per half.
    expect(boxes.get(6)).toHaveLength(1)
    const [box] = boxes.get(6) ?? []
    expect(box.x).toBeCloseTo(0.2)
    expect(box.y).toBeCloseTo(0.2)
    expect(box.w).toBeCloseTo(0.4)
    expect(box.h).toBeCloseTo(0.4)
  })

  it('punches the vignetted corners the board colour never reached', () => {
    const px = blank()
    fill(px, CALIBRATION_COLORS[0], 20, 10, 40, 20)
    fill(px, '#1a0505', 20, 10, 4, 4) // corner falloff: too dark to carry a hue

    const { boxes, owner } = segmentCalibration(px, W, H)
    punchBoard(px, owner, 0, boxes.get(0) ?? [], W, H)
    expect(alphaAt(px, 21, 11)).toBe(0) // dark corner opened with the rest of the board
    expect(alphaAt(px, 5, 5)).toBe(255) // scenery outside the box untouched
  })
})

describe('aspectVerdict', () => {
  const board = 16 / 9

  it('passes a texture cut for the board', () => {
    expect(aspectVerdict(1920, 1080, board)).toBe('ok')
  })

  it('flags a square logo on a widescreen board', () => {
    expect(aspectVerdict(1024, 1024, board)).toBe('stretched')
  })

  it('allows for the viewing angle of the calibration shot', () => {
    expect(aspectVerdict(1600, 1000, board)).toBe('ok') // 1.60 vs 1.78 — within tolerance
    expect(aspectVerdict(1200, 1000, board)).toBe('stretched') // 1.20 vs 1.78 — not
  })

  it('stays unknown until the image has actually loaded', () => {
    expect(aspectVerdict(0, 0, board)).toBe('unknown')
    expect(aspectVerdict(1920, 1080, 0)).toBe('unknown')
  })
})

describe('surfaceKind / textureCrop', () => {
  it('calls the skinny pennants flags and everything wider a board face', () => {
    expect(surfaceKind(0.08)).toBe('flag') // measured pennant
    expect(surfaceKind(0.25)).toBe('flag')
    expect(surfaceKind(0.56)).toBe('face') // narrowest measured face
    expect(surfaceKind(1.22)).toBe('face')
  })

  it('splits the texture at the flag strip, with no overlap and no gap', () => {
    const face = textureCrop('face')
    const flag = textureCrop('flag')
    expect(face.y).toBe(0)
    expect(face.h + flag.h).toBeCloseTo(1)
    expect(flag.y).toBeCloseTo(face.h)
    expect(flag.h).toBeCloseTo(337 / 2049)
  })
})

describe('boxAspect', () => {
  it('measures the board in image pixels, not in box fractions', () => {
    expect(boxAspect({ x: 0, y: 0, w: 0.5, h: 0.5 }, 1920, 1080)).toBeCloseTo(1920 / 1080)
  })
})

describe('resolutionNote', () => {
  it('says nothing about a sensible texture', () => {
    expect(resolutionNote(2048, 1024)).toBeNull()
  })

  it('calls out an oversized one', () => {
    expect(resolutionNote(8192, 4096)).toContain('oversized')
  })
})
