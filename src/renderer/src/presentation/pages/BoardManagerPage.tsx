import { useEffect, useState } from 'react'
import { Image as ImageIcon, RefreshCw, Save, XCircle, Upload, Check, AlertTriangle, Eye } from 'lucide-react'
import type { BoardSlot } from '@shared/models'
import { api } from '../../lib/api'
import { PageHeader, Card, Button, Badge, Field } from '../components/ui'
import { StationScoped } from '../components/StationScoped'
import { PermissionGate } from '../components/PermissionGate'
import { BOARD_KEY_PREFIX, BOARD_NAMES, BOARD_SECTION, boardIsInGame, boardName } from '../../lib/boards'
import { CONFIG_WRITE_PARAMS } from '../../lib/stationConfig'
import { FLAG_TEXTURE_SHARE, aspectVerdict, resolutionNote } from '../../lib/boardPreview'
import { loadBoardPreviews, hasCalibration, type BoardPreview } from '../../lib/boardCalibration'

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

/**
 * One surface of a board assembly. The face shows the top of the texture, a pennant shows the
 * flag strip from the bottom — rotated a quarter turn, which is how the game flies it.
 */
function Surface({
  url,
  name,
  surface,
  onLoad,
  onError
}: {
  url: string
  name: string
  surface: BoardPreview
  onLoad?: (w: number, h: number) => void
  onError?: () => void
}) {
  const { box, crop, kind, aspect } = surface
  const cropped = (
    <div className="absolute inset-0 overflow-hidden">
      <img
        src={url}
        alt={name}
        style={{
          position: 'absolute',
          left: 0,
          top: `${(-crop.y / crop.h) * 100}%`,
          width: '100%',
          height: `${100 / crop.h}%`,
          objectFit: 'fill'
        }}
        onLoad={(e) => onLoad?.(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)}
        onError={onError}
      />
    </div>
  )

  return (
    <div
      className="absolute overflow-hidden"
      style={{
        left: `${box.x * 100}%`,
        top: `${box.y * 100}%`,
        width: `${box.w * 100}%`,
        height: `${box.h * 100}%`
      }}
    >
      {kind === 'flag' ? (
        // Clockwise, confirmed against the reference artwork: the strip's left end flies at the
        // top. Rotating swaps the extents, so undo that with the box's own aspect to refill it.
        <div
          className="absolute inset-0"
          style={{ transform: `rotate(90deg) scale(${1 / aspect}, ${aspect})` }}
        >
          {cropped}
        </div>
      ) : (
        cropped
      )}
    </div>
  )
}

/**
 * Shows the texture where it actually lands in-game: the calibration screenshot is layered on
 * top with the board punched out, and the texture sits behind it in each of the board's
 * surfaces. With no calibration shot for this board it degrades to a plain thumbnail.
 */
function BoardTile({
  url,
  name,
  previews,
  shown,
  busy,
  onShow
}: {
  url: string
  name: string
  previews: BoardPreview[]
  shown: boolean
  busy: boolean
  onShow: () => void
}) {
  const [view, setView] = useState(0)
  const [broken, setBroken] = useState(false)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)

  // A slot can appear in several districts; show one shot at a time, with all its surfaces.
  const shots = [...new Set(previews.map((p) => p.shot))]
  const shot = shots[Math.min(view, shots.length - 1)]
  const surfaces = previews.filter((p) => p.shot === shot)
  const preview = surfaces.find((s) => s.kind === 'face') ?? surfaces[0]

  // A new URL is innocent until its own load fails.
  useEffect(() => {
    setBroken(false)
    setSize(null)
  }, [url])

  // Only the face region of the texture lands on the board — the flag strip goes to the pennants.
  const verdict =
    preview?.kind === 'face' && size
      ? aspectVerdict(size.w, size.h * (1 - FLAG_TEXTURE_SHARE), preview.aspect)
      : 'unknown'
  const oversized = size ? resolutionNote(size.w, size.h) : null

  const texture = url ? (
    <img
      src={url}
      alt={name}
      className="w-full h-full"
      style={{ objectFit: 'cover' }}
      onError={() => setBroken(true)}
      onLoad={(e) => setSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
    />
  ) : null

  return (
    <div className="grid gap-2">
      {preview ? (
        <div className="relative rounded-lg overflow-hidden bg-[var(--bg)] border border-[var(--border-soft)]">
          {!!url &&
            surfaces.map((s, i) => (
              <Surface
                key={`${s.box.x}-${s.box.y}`}
                url={url}
                name={name}
                surface={s}
                // One surface reports for the whole tile — they all load the same image.
                onLoad={i === 0 ? (w, h) => setSize({ w, h }) : undefined}
                onError={i === 0 ? () => setBroken(true) : undefined}
              />
            ))}
          <img src={preview.cutoutUrl} alt="" className="relative block w-full" />
        </div>
      ) : (
        <div className="aspect-video rounded-lg overflow-hidden bg-[var(--bg)] border border-[var(--border-soft)] grid place-items-center">
          {texture ?? <span className="text-[12px] text-[var(--text-faint)]">no image</span>}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 min-h-[20px]">
        {shots.length > 1 &&
          shots.map((s, i) => (
            <button
              key={s}
              className="chip"
              onClick={() => setView(i)}
              style={s === shot ? { color: 'var(--accent)' } : undefined}
            >
              {s}
            </button>
          ))}
        {!!url && broken && (
          <Badge tone="bad">
            <XCircle size={11} /> image failed to load
          </Badge>
        )}
        {!broken && verdict === 'stretched' && (
          <Badge tone="warn">
            <AlertTriangle size={11} /> will look stretched
          </Badge>
        )}
        {!broken && oversized && <Badge tone="warn">{oversized}</Badge>}
        {!shown && hasCalibration() && (
          // Opt-in: building it means segmenting every calibration screenshot, which takes a
          // moment, and most visits to this page do not need it.
          <Button onClick={onShow} disabled={busy}>
            <Eye size={13} /> {busy ? 'Loading…' : 'Load preview (beta)'}
          </Button>
        )}
        {shown && !preview && (
          <span className="text-[11px] text-[var(--text-faint)]">not found in the calibration shots</span>
        )}
      </div>
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

            <div className="flex gap-2">
              <PermissionGate scope="station_config:write">
                <Button variant="primary" onClick={() => void apply(slot)}>
                  <Upload size={13} /> Apply
                </Button>
              </PermissionGate>
              <Button onClick={() => setUrl(slot.key, '')}>
                <XCircle size={13} /> Clear
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
