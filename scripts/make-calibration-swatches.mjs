// Writes one solid-colour PNG per board slot, for in-game calibration.
// Hand-rolled encoder so this needs no dependency: 8x8 RGB, one IDAT.
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const COLORS = [
  '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#00FFFF',
  '#FF00FF', '#FF8000', '#00FF80', '#8000FF', '#FF0080'
]
const SIZE = 8
const OUT = process.argv[2] ?? '.'

const TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (buf) => {
  let c = 0xffffffff
  for (const b of buf) c = TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function solidPng(r, g, b) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(SIZE, 0)
  ihdr.writeUInt32BE(SIZE, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // colour type: truecolour
  // 10-12: deflate / adaptive filter / no interlace, all 0
  const raw = Buffer.alloc(SIZE * (1 + SIZE * 3))
  for (let y = 0; y < SIZE; y++) {
    const row = y * (1 + SIZE * 3)
    raw[row] = 0 // filter: none
    for (let x = 0; x < SIZE; x++) {
      const p = row + 1 + x * 3
      raw[p] = r
      raw[p + 1] = g
      raw[p + 2] = b
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ])
}

mkdirSync(OUT, { recursive: true })
COLORS.forEach((hex, slot) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  const name = `board-cal-${slot}-${hex.slice(1).toLowerCase()}.png`
  writeFileSync(join(OUT, name), solidPng(r, g, b))
  console.log(`${name}  slot ${slot}  ${hex}`)
})
