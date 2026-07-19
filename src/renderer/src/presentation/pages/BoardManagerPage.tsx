import { useEffect, useState } from 'react'
import { Image as ImageIcon, RefreshCw, Save, XCircle, Upload, Check } from 'lucide-react'
import type { BoardSlot } from '@shared/models'
import { api } from '../../lib/api'
import { PageHeader, Card, Button, Badge, Field } from '../components/ui'
import { StationScoped } from '../components/StationScoped'
import { PermissionGate } from '../components/PermissionGate'
import { BOARD_KEY_PREFIX, BOARD_NAMES, BOARD_SECTION, boardName } from '../../lib/boards'
import { CONFIG_WRITE_PARAMS } from '../../lib/stationConfig'

/** Named slots 0-9 always render (empty = no image yet), so the layout matches the dashboard. */
const DEFAULT_SLOTS: BoardSlot[] = BOARD_NAMES.map((b, i) => ({
  key: `${BOARD_KEY_PREFIX}${i}`,
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
  const byKey = new Map(DEFAULT_SLOTS.map((s) => [s.key, { ...s }]))
  for (const [k, v] of Object.entries(cfg)) {
    if (!k.startsWith(BOARD_KEY_PREFIX) || (typeof v !== 'string' && v != null)) continue
    const slot = Number(k.slice(BOARD_KEY_PREFIX.length))
    byKey.set(k, { key: k, name: boardName(slot).name, textureUrl: typeof v === 'string' ? v : '' })
  }
  return [...byKey.values()].sort((a, b) => slotNumber(a.key) - slotNumber(b.key))
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

  async function load() {
    setLoading(true)
    const res = await api.request({ endpointId: 'station.config.get', params: { stationId } })
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
  async function writeConfig(patch: Record<string, string>) {
    await api.request({
      endpointId: 'station.config.set',
      params: { stationId, ...CONFIG_WRITE_PARAMS },
      body: patch
    })
  }

  async function apply(slot: BoardSlot) {
    await writeConfig({ [slot.key]: slot.textureUrl })
    setSavedKey(slot.key)
    setTimeout(() => setSavedKey(''), 1200)
  }

  async function saveAll() {
    const changed = slots.filter((s) => s.textureUrl !== original.find((o) => o.key === s.key)?.textureUrl)
    if (!changed.length) return
    await writeConfig(Object.fromEntries(changed.map((s) => [s.key, s.textureUrl])))
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
              </div>
              {savedKey === slot.key && <Badge tone="good"><Check size={11} /> applied</Badge>}
            </div>

            <div className="aspect-video rounded-lg overflow-hidden bg-[var(--bg)] border border-[var(--border-soft)] grid place-items-center">
              {slot.textureUrl ? (
                // Live preview updates as the URL changes.
                <img
                  src={slot.textureUrl}
                  alt={slot.name}
                  className="w-full h-full object-cover"
                  onError={(e) => (e.currentTarget.style.display = 'none')}
                  onLoad={(e) => (e.currentTarget.style.display = 'block')}
                />
              ) : (
                <span className="text-[12px] text-[var(--text-faint)]">no image</span>
              )}
            </div>

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
