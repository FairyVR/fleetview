/**
 * Saved board configurations and the per-board URL library.
 *
 * Both ride the local Config Library's existing `Preset` records, so there is no new store and
 * no new IPC:
 *  - a **set** is one preset per named configuration (`kind: 'board-layout'`), holding the URL
 *    for every board at once;
 *  - the **per-board library** is a single preset (`kind: 'board-slot'`) holding every slot's
 *    entries, so the whole thing loads and saves in one call.
 *
 * `Preset.data` is untyped JSON that survives export/import and hand-editing, so everything
 * read out of it goes through the parsers below rather than being trusted.
 */
import type { BoardSlot } from '@shared/models'
import { BOARD_KEY_PREFIX, BOARD_SLOTS } from './boards'

export const BOARD_SET_KIND = 'board-layout'
export const BOARD_SLOT_KIND = 'board-slot'

/** The one record holding every slot's history. Found by kind, so the name is only a label. */
export const SLOT_LIBRARY_NAME = 'Board slot library'

/**
 * Unpinned entries kept per slot. Enough to cover a session of experimenting without the chip
 * list outgrowing the card; pinning is what makes an entry survive past this.
 */
export const MAX_RECENT_PER_SLOT = 12

/** Beyond this a "URL" is a paste accident, not a texture. */
const MAX_URL_LENGTH = 2048

export interface SlotEntry {
  url: string
  /** Optional label, set when the user pins it. */
  name?: string
  /** Pinned entries sort first, are shown under "Saved", and are exempt from the cap. */
  pinned: boolean
  lastUsed: number
}

/** Per-slot entries, keyed by the board's config-key index (3, 4, 5 … not 0-9). */
export type SlotLibrary = Record<number, SlotEntry[]>

/** A saved configuration: every board's URL, keyed by full config key. */
export type BoardSet = Record<string, string>

const cleanUrl = (v: unknown): string | null => {
  if (typeof v !== 'string') return null
  const url = v.trim()
  return url && url.length <= MAX_URL_LENGTH ? url : null
}

const cleanName = (v: unknown): string | undefined => {
  if (typeof v !== 'string') return undefined
  const name = v.trim().slice(0, 80)
  return name || undefined
}

const slotKey = (slot: number): string => `${BOARD_KEY_PREFIX}${slot}`

/** Config-key index for a board key, or null when the key is not a board we know. */
export function slotOfKey(key: string): number | null {
  if (!key.startsWith(BOARD_KEY_PREFIX)) return null
  const slot = Number(key.slice(BOARD_KEY_PREFIX.length))
  return BOARD_SLOTS.includes(slot) ? slot : null
}

/**
 * Read a slot library out of preset data. Anything malformed is dropped entry by entry rather
 * than failing the whole library — one bad record from a hand-edited bundle must not cost the
 * user every other slot's history.
 */
export function parseSlotLibrary(data: unknown): SlotLibrary {
  const lib: SlotLibrary = {}
  if (!data || typeof data !== 'object') return lib
  const bySlot = (data as { bySlot?: unknown }).bySlot
  if (!bySlot || typeof bySlot !== 'object') return lib

  for (const [rawSlot, rawEntries] of Object.entries(bySlot as Record<string, unknown>)) {
    const slot = Number(rawSlot)
    if (!BOARD_SLOTS.includes(slot) || !Array.isArray(rawEntries)) continue

    const seen = new Set<string>()
    const entries: SlotEntry[] = []
    for (const raw of rawEntries) {
      if (!raw || typeof raw !== 'object') continue
      const e = raw as Record<string, unknown>
      const url = cleanUrl(e.url)
      if (!url || seen.has(url)) continue
      seen.add(url)
      const lastUsed = Number(e.lastUsed)
      entries.push({
        url,
        name: cleanName(e.name),
        pinned: e.pinned === true,
        lastUsed: Number.isFinite(lastUsed) ? lastUsed : 0
      })
    }
    if (entries.length) lib[slot] = entries
  }
  return lib
}

/** Wrap a library for storage. */
export const serializeSlotLibrary = (lib: SlotLibrary): { bySlot: SlotLibrary } => ({ bySlot: lib })

/** Read a saved configuration out of preset data, keeping only real board keys. */
export function parseBoardSet(data: unknown): BoardSet {
  const set: BoardSet = {}
  if (!data || typeof data !== 'object') return set
  const slots = (data as { slots?: unknown }).slots
  if (!slots || typeof slots !== 'object') return set

  for (const [key, value] of Object.entries(slots as Record<string, unknown>)) {
    if (slotOfKey(key) === null) continue
    const url = cleanUrl(value)
    if (url) set[key] = url
  }
  return set
}

/** Wrap a set for storage. */
export const serializeBoardSet = (set: BoardSet): { slots: BoardSet } => ({ slots: set })

/**
 * Capture the current editor state as a saved configuration.
 *
 * Empty boards are recorded as empty strings rather than omitted: clearing every board is a
 * legitimate configuration, and dropping the blanks would make applying a set unable to express it.
 */
export function buildSet(slots: BoardSlot[]): BoardSet {
  const set: BoardSet = {}
  for (const slot of slots) {
    if (slotOfKey(slot.key) === null) continue
    set[slot.key] = cleanUrl(slot.textureUrl) ?? ''
  }
  return set
}

/**
 * Apply a saved configuration to the editor. Boards the set does not mention keep their current
 * URL — a set saved before a board existed must not silently blank it.
 */
export function applySet(slots: BoardSlot[], set: BoardSet): BoardSlot[] {
  return slots.map((slot) => (slot.key in set ? { ...slot, textureUrl: set[slot.key] } : slot))
}

/** How many boards a set would actually change, for the confirm-free "apply" affordance. */
export function setChangeCount(slots: BoardSlot[], set: BoardSet): number {
  return slots.filter((slot) => slot.key in set && set[slot.key] !== slot.textureUrl).length
}

/**
 * Record that a URL was applied to a board.
 *
 * Called only after a write succeeds, so the list reflects what actually reached the station
 * rather than every keystroke. An existing entry is bumped rather than duplicated, and keeps its
 * pin and name.
 */
export function recordUse(lib: SlotLibrary, slot: number, rawUrl: string, at: number): SlotLibrary {
  const url = cleanUrl(rawUrl)
  if (url === null || !BOARD_SLOTS.includes(slot)) return lib

  const existing = lib[slot] ?? []
  const previous = existing.find((e) => e.url === url)
  const entry: SlotEntry = {
    url,
    name: previous?.name,
    pinned: previous?.pinned ?? false,
    lastUsed: at
  }
  const rest = existing.filter((e) => e.url !== url)

  // Pinned entries are never evicted; the cap applies to the unpinned tail only.
  const pinned = rest.filter((e) => e.pinned)
  const recent = rest.filter((e) => !e.pinned)
  const kept = entry.pinned ? recent : recent.slice(0, MAX_RECENT_PER_SLOT - 1)

  return { ...lib, [slot]: [entry, ...pinned, ...kept] }
}

/** Pin or unpin an entry, optionally labelling it. Unpinning keeps it in the recent list. */
export function setPinned(
  lib: SlotLibrary,
  slot: number,
  url: string,
  pinned: boolean,
  name?: string
): SlotLibrary {
  const entries = lib[slot]
  if (!entries) return lib
  return {
    ...lib,
    [slot]: entries.map((e) =>
      e.url === url ? { ...e, pinned, name: pinned ? (cleanName(name) ?? e.name) : e.name } : e
    )
  }
}

/** Drop one entry. Removing the last one drops the slot too, so the record stays small. */
export function removeEntry(lib: SlotLibrary, slot: number, url: string): SlotLibrary {
  const entries = lib[slot]
  if (!entries) return lib
  const kept = entries.filter((e) => e.url !== url)
  const next = { ...lib }
  if (kept.length) next[slot] = kept
  else delete next[slot]
  return next
}

/**
 * A slot's entries split for the picker: the user's own saved list, and everything else as
 * recent history. Both newest first; saved entries with a label sort by it so a curated list
 * reads alphabetically rather than by last touch.
 */
export function slotEntries(
  lib: SlotLibrary,
  slot: number
): { saved: SlotEntry[]; recent: SlotEntry[] } {
  const entries = lib[slot] ?? []
  const saved = entries
    .filter((e) => e.pinned)
    .sort((a, b) => (a.name && b.name ? a.name.localeCompare(b.name) : b.lastUsed - a.lastUsed))
  const recent = entries.filter((e) => !e.pinned).sort((a, b) => b.lastUsed - a.lastUsed)
  return { saved, recent }
}

/** Short label for a URL chip — the filename is what distinguishes two textures at a glance. */
export function urlLabel(url: string): string {
  const withoutQuery = url.split(/[?#]/)[0]
  const file = withoutQuery.slice(withoutQuery.lastIndexOf('/') + 1)
  return file || withoutQuery.slice(0, 40) || url.slice(0, 40)
}

/** Every board key, for callers that need the full set order. */
export const BOARD_KEYS = BOARD_SLOTS.map(slotKey)
