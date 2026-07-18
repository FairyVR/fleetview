import { useEffect, useState } from 'react'
import { Image as ImageIcon, RefreshCw, Save, XCircle, Upload, Check } from 'lucide-react'
import type { BoardSlot } from '@shared/models'
import { api } from '../../lib/api'
import { PageHeader, Card, Button, Badge, Field } from '../components/ui'
import { StationScoped } from '../components/StationScoped'
import { PermissionGate } from '../components/PermissionGate'

/** Fallback slot layout so the manager is usable before a live board.get succeeds. */
const DEFAULT_SLOTS: BoardSlot[] = Array.from({ length: 4 }, (_, i) => ({
  key: `BoardTextureUrl${i}`,
  name: `Board ${i}`,
  textureUrl: ''
}))

export default function BoardManagerPage() {
  return (
    <div>
      <PageHeader
        title="Board Manager"
        subtitle="Manage every BoardTextureUrl slot on a station. Edit the URL, preview live before saving, then apply."
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
    const res = await api.request<{ slots?: BoardSlot[] }>({ endpointId: 'board.get', params: { stationId } })
    const fetched = res.data?.slots
    const next = fetched && fetched.length ? fetched : DEFAULT_SLOTS
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

  async function apply(slot: BoardSlot) {
    await api.request({ endpointId: 'board.set', params: { stationId, slotKey: slot.key }, body: { textureUrl: slot.textureUrl } })
    setSavedKey(slot.key)
    setTimeout(() => setSavedKey(''), 1200)
  }

  async function saveAll() {
    const changed = slots.filter((s) => s.textureUrl !== original.find((o) => o.key === s.key)?.textureUrl)
    for (const slot of changed) await apply(slot)
    setOriginal(slots)
  }

  const dirty = JSON.stringify(slots) !== JSON.stringify(original)

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Button onClick={() => void load()} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Reload
        </Button>
        <PermissionGate scope="custom_config:write">
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
                <span className="font-medium">{slot.name}</span>
                <Badge>{slot.key}</Badge>
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
              <PermissionGate scope="custom_config:write">
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
