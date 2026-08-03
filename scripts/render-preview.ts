/**
 * Renders a board preview composite offline, the same way BoardManagerPage does in CSS, so the
 * result can be eyeballed without launching the app.
 *
 *   powershell -File scripts/dump-png.ps1
 *   npx tsx scripts/render-preview.ts <shot.raw> <colorIndex> <out.png>
 *
 * The texture is synthetic on purpose: a labelled grid whose face and flag regions are obviously
 * different, so anything placed, cropped or rotated wrongly is visible at a glance.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'
import {
  FLAG_TEXTURE_SHARE,
  boxAspect,
  punchBoard,
  segmentCalibration,
  surfaceKind,
  textureCrop,
  type Box
} from '../src/renderer/src/lib/boardPreview'

// ── PNG encode ────────────────────────────────────────────────────────────────
const TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (buf: Buffer): number => {
  let c = 0xffffffff
  for (const b of buf) c = TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}
function encodePng(px: Uint8ClampedArray, w: number, h: number): Buffer {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  const raw = Buffer.alloc(h * (1 + w * 4))
  for (let y = 0; y < h; y++) {
    const row = y * (1 + w * 4)
    for (let x = 0; x < w; x++) {
      const s = (y * w + x) * 4
      const d = row + 1 + x * 4
      raw[d] = px[s]
      raw[d + 1] = px[s + 1]
      raw[d + 2] = px[s + 2]
      raw[d + 3] = px[s + 3]
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 6 })),
    chunk('IEND', Buffer.alloc(0))
  ])
}

// ── Synthetic texture: 1983×2049, face on top, flag strip along the bottom ────
const TW = 1983
const TH = 2049
const FLAG_TOP = Math.round(TH * (1 - FLAG_TEXTURE_SHARE))

function makeTexture(): Uint8ClampedArray {
  const px = new Uint8ClampedArray(TW * TH * 4)
  for (let y = 0; y < TH; y++) {
    for (let x = 0; x < TW; x++) {
      const p = (y * TW + x) * 4
      let r: number, g: number, b: number
      if (y >= FLAG_TOP) {
        // Flag strip: bright banded ramp, dark at its left end so rotation direction shows.
        const t = x / TW
        r = Math.round(255 * t)
        g = 40
        b = Math.round(255 * (1 - t))
        if (Math.floor(x / 120) % 2 === 0) g = 200
      } else {
        // Face: checkerboard with a strong border and a bright top-left corner marker.
        const onEdge = x < 40 || y < 40 || x > TW - 40 || y > FLAG_TOP - 40
        const corner = x < 260 && y < 260
        const check = (Math.floor(x / 160) + Math.floor(y / 160)) % 2 === 0
        r = corner ? 255 : onEdge ? 255 : check ? 60 : 190
        g = corner ? 255 : onEdge ? 255 : check ? 190 : 220
        b = corner ? 0 : onEdge ? 255 : check ? 230 : 60
      }
      px[p] = r
      px[p + 1] = g
      px[p + 2] = b
      px[p + 3] = 255
    }
  }
  return px
}

/** Sample the texture at (u,v) within a crop rect, nearest-neighbour. */
function sample(tex: Uint8ClampedArray, crop: Box, u: number, v: number): [number, number, number] {
  const tx = Math.min(TW - 1, Math.max(0, Math.round((crop.x + u * crop.w) * TW)))
  const ty = Math.min(TH - 1, Math.max(0, Math.round((crop.y + v * crop.h) * TH)))
  const p = (ty * TW + tx) * 4
  return [tex[p], tex[p + 1], tex[p + 2]]
}

// ── Composite ────────────────────────────────────────────────────────────────
const [src, indexArg, out] = process.argv.slice(2)
const colorIndex = Number(indexArg)

const buf = readFileSync(src)
const width = buf.readUInt32LE(0)
const height = buf.readUInt32LE(4)
const scene = new Uint8ClampedArray(buf.subarray(8))
for (let i = 0; i < scene.length; i += 4) {
  const b = scene[i]
  scene[i] = scene[i + 2]
  scene[i + 2] = b
}

const { boxes, owner } = segmentCalibration(scene, width, height)
const list = boxes.get(colorIndex)
if (!list?.length) {
  console.error(`colour ${colorIndex} not found in ${src}`)
  process.exit(1)
}

punchBoard(scene, owner, colorIndex, list, width, height)
const tex = makeTexture()

for (const box of list) {
  const aspect = boxAspect(box, width, height)
  const kind = surfaceKind(aspect)
  const crop = textureCrop(kind)
  const x0 = Math.round(box.x * width)
  const y0 = Math.round(box.y * height)
  const bw = Math.round(box.w * width)
  const bh = Math.round(box.h * height)
  console.log(`  surface ${kind.padEnd(4)} ${bw}×${bh} @${x0},${y0} aspect ${aspect.toFixed(2)}`)

  for (let y = y0; y < Math.min(height, y0 + bh); y++) {
    for (let x = x0; x < Math.min(width, x0 + bw); x++) {
      const i = y * width + x
      if (scene[i * 4 + 3] !== 0) continue // scenery in front stays
      // Position within the surface, 0..1.
      const fx = (x - x0) / bw
      const fy = (y - y0) / bh
      // A pennant flies the flag strip rotated a quarter turn clockwise: the strip's left end
      // is at the top of the pennant, so screen-down maps to texture-right.
      const [u, v] = kind === 'flag' ? [fy, 1 - fx] : [fx, fy]
      const [r, g, b] = sample(tex, crop, u, v)
      scene[i * 4] = r
      scene[i * 4 + 1] = g
      scene[i * 4 + 2] = b
      scene[i * 4 + 3] = 255
    }
  }
}

writeFileSync(out, encodePng(scene, width, height))
console.log(`wrote ${out}`)
