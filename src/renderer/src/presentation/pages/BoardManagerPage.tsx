import { useEffect, useState } from 'react'
import {
  Image as ImageIcon,
  RefreshCw,
  Save,
  XCircle,
  Upload,
  Check,
  AlertTriangle,
  ListPlus
} from 'lucide-react'
import type { BoardSlot } from '@shared/models'
import { api } from '../../lib/api'
import { PageHeader, Card, Button, Badge, Field } from '../components/ui'
import { StationScoped } from '../components/StationScoped'
import { PermissionGate } from '../components/PermissionGate'
import { BOARD_KEY_PREFIX, BOARD_NAMES, BOARD_SECTION, boardIsInGame, boardName } from '../../lib/boards'
import { CONFIG_WRITE_PARAMS } from '../../lib/stationConfig'
import { loadBoardPreviews, type BoardPreview } from '../../lib/boardCalibration'
import { BoardTile } from '../components/BoardTile'
import {
  BOARD_SET_KIND,
  BOARD_SLOT_KIND,
  SLOT_LIBRARY_NAME,
  applySet,
  buildSet,
  parseBoardSet,
  parseSlotLibrary,
  recordUse,
  removeEntry,
  serializeBoardSet,
  serializeSlotLibrary,
  setChangeCount,
  setPinned,
  type BoardSet,
  type SlotLibrary
} from '../../lib/boardLibrary'
import { BoardSetBar, BoardUrlPicker } from '../components/BoardLibraryPanel'

/** All ten boards always render (empty = no image yet), so the layout matches the dashboard. */
const DEFAULT_SLOTS: BoardSlot[] = BOARD_NAMES.map((b) => ({
  key: `${BOARD_KEY_PREFIX}${b.slot}`,
  name: b.name,
  textureUrl: ''
}))

/**
 * Board textures are not a separate endpoint — they are keys inside the station config
 * at `config.stationConfig.BoardTextureUrlN` (live-verified). Merge the named slots with
 * whatever slots the config actually has set.
 */
function slotsFromConfig(data: unknown): BoardSlot[] {
  const d = data as Record<string, unknown> | null
  if (!d || typeof d !== 'object') return DEFAULT_SLOTS
  // The config may be at the root or nested under `config`.
  const cfg = (typeof d.config === 'object' && d.config !== null ? d.config : d) as Record<string, unknown>
  // Only the ten real boards — the config carries other BoardTextureUrl keys that drive nothing,
  // and showing them would invent boards the station does not have.
  return DEFAULT_SLOTS.map((slot) => {
    const v = cfg[slot.key]
    return { ...slot, textureUrl: typeof v === 'string' ? v : '' }
  })
}

const slotNumber = (key: string): number => Number(key.slice(BOARD_KEY_PREFIX.length)) || 0

export default function BoardManagerPage() {
  return (
    <div>
      <PageHeader
        title="Board Manager"
        subtitle={`${BOARD_SECTION} for the selected station only. Edit a board's image URL, preview it live, then apply.`}
      />
      <StationScoped>{(stationId) => <BoardEditor stationId={stationId} />}</StationScoped>
    </div>
  )
}


function BoardEditor({ stationId }: { stationId: string }) {
  const [slots, setSlots] = useState<BoardSlot[]>(DEFAULT_SLOTS)
  const [original, setOriginal] = useState<BoardSlot[]>(DEFAULT_SLOTS)
  const [loading, setLoading] = useState(false)
  const [savedKey, setSavedKey] = useState('')
  const [error, setError] = useState('')
  const [previews, setPreviews] = useState<Map<number, BoardPreview[]>>(new Map())
  const [shown, setShown] = useState<Set<string>>(new Set())
  const [busyKey, setBusyKey] = useState('')
  const [library, setLibrary] = useState<SlotLibrary>({})
  /** Id of the single preset holding the slot library, once it exists. */
  const [libraryId, setLibraryId] = useState<string | undefined>()
  const [savedSets, setSavedSets] = useState<Array<{ id: string; name: string; set: BoardSet }>>([])
  const [pickerKey, setPickerKey] = useState('')

  /**
   * Saved configurations and per-board history both live in the local Config Library. A failure
   * here must never block editing boards, so it degrades to an empty library and a badge.
   */
  async function loadLibrary() {
    try {
      const presets = await api.listPresets()
      setSavedSets(
        presets
          .filter((p) => p.kind === BOARD_SET_KIND)
          .map((p) => ({ id: p.id, name: p.name, set: parseBoardSet(p.data) }))
      )
      const record = presets.find((p) => p.kind === BOARD_SLOT_KIND)
      setLibraryId(record?.id)
      setLibrary(parseSlotLibrary(record?.data))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the board library.')
    }
  }

  /** Write the slot library back to its single preset, creating it on first use. */
  async function persistLibrary(next: SlotLibrary) {
    setLibrary(next)
    try {
      const saved = await api.savePreset({
        id: libraryId,
        kind: BOARD_SLOT_KIND,
        name: SLOT_LIBRARY_NAME,
        data: serializeSlotLibrary(next),
        tags: []
      })
      setLibraryId(saved.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the board library.')
    }
  }

  /** Saving under an existing name overwrites it rather than growing a pile of duplicates. */
  async function saveSet(name: string) {
    try {
      await api.savePreset({
        id: savedSets.find((s) => s.name.toLowerCase() === name.toLowerCase())?.id,
        kind: BOARD_SET_KIND,
        name,
        data: serializeBoardSet(buildSet(slots)),
        tags: []
      })
      await loadLibrary()
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not save "${name}".`)
    }
  }

  async function deleteSet(id: string) {
    try {
      await api.deletePreset(id)
      await loadLibrary()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete that configuration.')
    }
  }

  /** Remember a URL that actually reached the station. */
  function remember(applied: BoardSlot[]) {
    const at = Date.now()
    let next = library
    for (const slot of applied) {
      if (slot.textureUrl) next = recordUse(next, slotNumber(slot.key), slot.textureUrl, at)
    }
    if (next !== library) void persistLibrary(next)
  }

  /**
   * Previews are built on request, per board. The work is segmenting every calibration
   * screenshot — seconds of canvas work — so it does not belong in a page load. The module
   * caches its result, so only the first board pays for it.
   */
  async function showPreview(key: string) {
    setBusyKey(key)
    try {
      setPreviews(await loadBoardPreviews())
      setShown((s) => new Set(s).add(key))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not build the preview.')
    } finally {
      setBusyKey('')
    }
  }

  async function load() {
    setLoading(true)
    setError('')
    const res = await api.request({ endpointId: 'station.config.get', params: { stationId } })
    if (!res.ok) {
      setError(res.error?.message ?? 'Could not load the station config.')
      setLoading(false)
      return
    }
    const fetched = slotsFromConfig(res.data)
    const next = fetched.length ? fetched : DEFAULT_SLOTS
    setSlots(next)
    setOriginal(next)
    setLoading(false)
  }
  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stationId])

  // The library is local and station-independent, so it loads once rather than per station.
  useEffect(() => {
    void loadLibrary()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function setUrl(key: string, url: string) {
    setSlots((s) => s.map((slot) => (slot.key === key ? { ...slot, textureUrl: url } : slot)))
  }

  /** Writes the config patch flat (no wrapper) — the shape the live API accepts. */
  function writeConfig(patch: Record<string, string>) {
    return api.request({
      endpointId: 'station.config.set',
      params: { stationId, ...CONFIG_WRITE_PARAMS },
      body: patch
    })
  }

  async function apply(slot: BoardSlot) {
    setError('')
    const res = await writeConfig({ [slot.key]: slot.textureUrl })
    if (!res.ok) {
      setError(res.error?.message ?? `Could not apply ${slot.name}.`)
      return
    }
    setSavedKey(slot.key)
    remember([slot])
    setTimeout(() => setSavedKey(''), 1200)
  }

  async function saveAll() {
    const changed = slots.filter((s) => s.textureUrl !== original.find((o) => o.key === s.key)?.textureUrl)
    if (!changed.length) return
    setError('')
    const res = await writeConfig(Object.fromEntries(changed.map((s) => [s.key, s.textureUrl])))
    if (!res.ok) {
      setError(res.error?.message ?? 'Could not save board changes.')
      return
    }
    setOriginal(slots)
    remember(changed)
  }

  const dirty = JSON.stringify(slots) !== JSON.stringify(original)

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Button onClick={() => void load()} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Reload
        </Button>
        <PermissionGate scope="station_config:write">
          <Button variant="primary" disabled={!dirty} onClick={() => void saveAll()}>
            <Save size={14} /> Save all
          </Button>
        </PermissionGate>
        {dirty && <Badge tone="warn">unsaved changes</Badge>}
        {error && <Badge tone="bad"><XCircle size={11} /> {error}</Badge>}
      </div>

      <BoardSetBar
        sets={savedSets.map((s) => ({ ...s, changes: setChangeCount(slots, s.set) }))}
        onApply={(s) => setSlots((current) => applySet(current, s.set))}
        onSave={(name) => void saveSet(name)}
        onDelete={(s) => void deleteSet(s.id)}
        busy={loading}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {slots.map((slot) => (
          <Card key={slot.key} className="grid gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ImageIcon size={15} className="text-[var(--accent)]" />
                <div>
                  <span className="font-medium">{slot.name}</span>
                  {boardName(slotNumber(slot.key)).alt && (
                    <div className="text-[11px] text-[var(--text-faint)]">
                      {boardName(slotNumber(slot.key)).alt}
                    </div>
                  )}
                </div>
                <Badge>#{slotNumber(slot.key)}</Badge>
                {!boardIsInGame(slotNumber(slot.key)) && (
                  <Badge tone="warn">
                    <AlertTriangle size={11} /> not used in game
                  </Badge>
                )}
              </div>
              {savedKey === slot.key && <Badge tone="good"><Check size={11} /> applied</Badge>}
            </div>

            <BoardTile
              url={slot.textureUrl}
              name={slot.name}
              previews={shown.has(slot.key) ? (previews.get(slotNumber(slot.key)) ?? []) : []}
              shown={shown.has(slot.key)}
              busy={busyKey === slot.key}
              onShow={() => void showPreview(slot.key)}
            />

            <Field label="Image URL">
              <input
                className="input mono text-[12px]"
                value={slot.textureUrl}
                onChange={(e) => setUrl(slot.key, e.target.value)}
                placeholder="https://…/texture.png"
              />
            </Field>

            {/* self-start: grid rows stretch, so an open picker next door would stretch these. */}
            <div className="flex gap-2 self-start">
              <PermissionGate scope="station_config:write">
                <Button variant="primary" onClick={() => void apply(slot)}>
                  <Upload size={13} /> Apply
                </Button>
              </PermissionGate>
              <Button
                onClick={() => setPickerKey((k) => (k === slot.key ? '' : slot.key))}
                variant={pickerKey === slot.key ? 'primary' : 'default'}
              >
                <ListPlus size={13} /> Change image
              </Button>
              <Button onClick={() => setUrl(slot.key, '')}>
                <XCircle size={13} /> Clear
              </Button>
            </div>

            {pickerKey === slot.key && (
              <BoardUrlPicker
                slot={slotNumber(slot.key)}
                library={library}
                currentUrl={slot.textureUrl}
                onUse={(url) => setUrl(slot.key, url)}
                onPin={(url, pinned) =>
                  void persistLibrary(setPinned(library, slotNumber(slot.key), url, pinned))
                }
                onRemove={(url) =>
                  void persistLibrary(removeEntry(library, slotNumber(slot.key), url))
                }
              />
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}
