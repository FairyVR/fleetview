import { describe, expect, it } from 'vitest'
import {
  MAX_RECENT_PER_SLOT,
  applySet,
  buildSet,
  parseBoardSet,
  parseSlotLibrary,
  recordUse,
  removeEntry,
  setChangeCount,
  setPinned,
  slotEntries,
  slotOfKey,
  urlLabel,
  type SlotLibrary
} from '../src/renderer/src/lib/boardLibrary'
import { BOARD_KEY_PREFIX } from '../src/renderer/src/lib/boards'
import type { BoardSlot } from '../src/shared/models'

const key = (slot: number): string => `${BOARD_KEY_PREFIX}${slot}`
const slots = (...pairs: Array<[number, string]>): BoardSlot[] =>
  pairs.map(([slot, textureUrl]) => ({ key: key(slot), name: `Board ${slot}`, textureUrl }))

describe('slotOfKey', () => {
  it('accepts only real board keys', () => {
    expect(slotOfKey(key(5))).toBe(5)
    // 0-2 exist in the config but drive nothing, so they are not boards.
    expect(slotOfKey(key(0))).toBeNull()
    expect(slotOfKey('config.stationConfig.SomethingElse')).toBeNull()
  })
})

describe('parseSlotLibrary', () => {
  it('returns an empty library for junk', () => {
    for (const junk of [null, undefined, 42, 'nope', {}, { bySlot: 'no' }]) {
      expect(parseSlotLibrary(junk)).toEqual({})
    }
  })

  it('drops bad entries without losing the rest', () => {
    const lib = parseSlotLibrary({
      bySlot: {
        5: [
          { url: 'https://a.png', pinned: true, lastUsed: 10, name: ' Halloween ' },
          { url: '   ', pinned: false, lastUsed: 5 },
          { nope: true },
          { url: 'https://a.png', lastUsed: 99 }, // duplicate URL
          { url: 'https://b.png', lastUsed: 'later' }
        ],
        99: [{ url: 'https://c.png' }], // not a board
        5000: 'nope'
      }
    })
    expect(Object.keys(lib)).toEqual(['5'])
    expect(lib[5]).toEqual([
      { url: 'https://a.png', name: 'Halloween', pinned: true, lastUsed: 10 },
      { url: 'https://b.png', name: undefined, pinned: false, lastUsed: 0 }
    ])
  })
})

describe('parseBoardSet', () => {
  it('keeps only real board keys with usable URLs', () => {
    expect(
      parseBoardSet({
        slots: {
          [key(5)]: ' https://a.png ',
          [key(0)]: 'https://ignored.png',
          nonsense: 'https://ignored.png',
          [key(6)]: 42
        }
      })
    ).toEqual({ [key(5)]: 'https://a.png' })
  })

  it('survives junk', () => {
    expect(parseBoardSet(null)).toEqual({})
    expect(parseBoardSet({ slots: [] })).toEqual({})
  })
})

describe('sets', () => {
  it('records empty boards so a set can clear them', () => {
    const set = buildSet(slots([5, 'https://a.png'], [6, '']))
    expect(set).toEqual({ [key(5)]: 'https://a.png', [key(6)]: '' })

    const applied = applySet(slots([5, 'https://old.png'], [6, 'https://old2.png']), set)
    expect(applied.map((s) => s.textureUrl)).toEqual(['https://a.png', ''])
  })

  it('leaves boards the set does not mention alone', () => {
    const applied = applySet(slots([5, 'https://keep.png'], [6, 'https://keep2.png']), {
      [key(6)]: 'https://new.png'
    })
    expect(applied.map((s) => s.textureUrl)).toEqual(['https://keep.png', 'https://new.png'])
  })

  it('counts only boards a set would actually change', () => {
    const current = slots([5, 'https://a.png'], [6, 'https://b.png'])
    expect(setChangeCount(current, { [key(5)]: 'https://a.png' })).toBe(0)
    expect(setChangeCount(current, { [key(5)]: 'https://z.png', [key(6)]: 'https://b.png' })).toBe(1)
  })
})

describe('recordUse', () => {
  it('ignores junk and unknown boards', () => {
    expect(recordUse({}, 5, '   ', 1)).toEqual({})
    expect(recordUse({}, 99, 'https://a.png', 1)).toEqual({})
  })

  it('bumps an existing URL instead of duplicating it, keeping its pin and name', () => {
    let lib: SlotLibrary = recordUse({}, 5, 'https://a.png', 1)
    lib = setPinned(lib, 5, 'https://a.png', true, 'Halloween')
    lib = recordUse(lib, 5, 'https://b.png', 2)
    lib = recordUse(lib, 5, 'https://a.png', 3)

    expect(lib[5]).toHaveLength(2)
    const a = lib[5].find((e) => e.url === 'https://a.png')
    expect(a).toEqual({ url: 'https://a.png', name: 'Halloween', pinned: true, lastUsed: 3 })
  })

  it('caps the unpinned tail but never evicts a pinned entry', () => {
    let lib: SlotLibrary = {}
    lib = recordUse(lib, 5, 'https://keep.png', 0)
    lib = setPinned(lib, 5, 'https://keep.png', true)
    for (let i = 1; i <= MAX_RECENT_PER_SLOT + 5; i++) {
      lib = recordUse(lib, 5, `https://n${i}.png`, i)
    }

    const { saved, recent } = slotEntries(lib, 5)
    expect(saved.map((e) => e.url)).toEqual(['https://keep.png'])
    expect(recent).toHaveLength(MAX_RECENT_PER_SLOT)
    // Newest first, oldest unpinned evicted.
    expect(recent[0].url).toBe(`https://n${MAX_RECENT_PER_SLOT + 5}.png`)
    expect(recent.some((e) => e.url === 'https://n1.png')).toBe(false)
  })
})

describe('slotEntries', () => {
  it('splits saved from recent and sorts a labelled list by name', () => {
    let lib: SlotLibrary = {}
    lib = recordUse(lib, 5, 'https://z.png', 1)
    lib = recordUse(lib, 5, 'https://a.png', 2)
    lib = recordUse(lib, 5, 'https://loose.png', 3)
    lib = setPinned(lib, 5, 'https://z.png', true, 'Zulu')
    lib = setPinned(lib, 5, 'https://a.png', true, 'Alpha')

    const { saved, recent } = slotEntries(lib, 5)
    expect(saved.map((e) => e.name)).toEqual(['Alpha', 'Zulu'])
    expect(recent.map((e) => e.url)).toEqual(['https://loose.png'])
  })

  it('is empty for a slot with no history', () => {
    expect(slotEntries({}, 5)).toEqual({ saved: [], recent: [] })
  })
})

describe('unpin and remove', () => {
  it('unpinning keeps the entry in recent', () => {
    let lib: SlotLibrary = recordUse({}, 5, 'https://a.png', 1)
    lib = setPinned(lib, 5, 'https://a.png', true, 'Named')
    lib = setPinned(lib, 5, 'https://a.png', false)
    expect(slotEntries(lib, 5).recent.map((e) => e.url)).toEqual(['https://a.png'])
  })

  it('removing the last entry drops the slot', () => {
    const lib = removeEntry(recordUse({}, 5, 'https://a.png', 1), 5, 'https://a.png')
    expect(lib[5]).toBeUndefined()
  })
})

describe('urlLabel', () => {
  it('shows the filename, ignoring query and hash', () => {
    expect(urlLabel('https://cdn.example.com/a/b/texture.png?v=2#x')).toBe('texture.png')
    // No filename to show — fall back to the URL itself rather than an empty chip.
    expect(urlLabel('https://example.com/')).toBe('https://example.com/')
  })
})
