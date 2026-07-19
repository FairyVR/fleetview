import { useState, useEffect, useCallback } from 'react'
import {
  GitCompare,
  RotateCcw,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  Save,
  RefreshCw,
  Star,
  ArrowDownToLine,
  Trash2
} from 'lucide-react'
import type { Preset } from '@shared/models'
import { PageHeader, Card, Button, Badge, EmptyState } from '../components/ui'
import { JsonEditor, JsonDiff, validateJson } from '../components/JsonEditor'
import { StationScoped } from '../components/StationScoped'
import { PermissionGate } from '../components/PermissionGate'
import { prettyJson } from '../../lib/format'
import { api } from '../../lib/api'
import { configDiff, CONFIG_WRITE_PARAMS } from '../../lib/stationConfig'

/**
 * Raw config workbench for the selected station: live baseline, diff, and a local
 * "favorites" library of config snippets that can be injected into the current config
 * (shallow key merge) — same spirit as the LE Config Library, but for station config.
 */
export default function ConfigEditorPage() {
  return (
    <div>
      <PageHeader
        title="Config Editor"
        subtitle="Edit the selected station's config as JSON, diff against the live baseline, and inject favorite config snippets from your library."
      />
      <StationScoped>{(stationId) => <Workbench stationId={stationId} />}</StationScoped>
    </div>
  )
}

function Workbench({ stationId }: { stationId: string }) {
  const [baseline, setBaseline] = useState('{}')
  const [text, setText] = useState('{}')
  const [showDiff, setShowDiff] = useState(false)
  const [loading, setLoading] = useState(false)
  const [note, setNote] = useState<{ tone: 'good' | 'bad'; msg: string } | null>(null)
  const [favorites, setFavorites] = useState<Preset[]>([])
  const [favName, setFavName] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.request({ endpointId: 'station.config.get', params: { stationId } })
      if (res.ok) {
        const cfg = (res.data as { config?: unknown } | null)?.config ?? res.data
        const pretty = prettyJson(cfg ?? {})
        setBaseline(pretty)
        setText(pretty)
      } else {
        setNote({ tone: 'bad', msg: res.error?.message ?? `HTTP ${res.status}` })
      }
    } finally {
      setLoading(false)
    }
  }, [stationId])

  const refreshFavorites = useCallback(async () => {
    const all = await api.listPresets()
    setFavorites(all.filter((p) => p.kind === 'config'))
  }, [])

  useEffect(() => {
    void load()
    void refreshFavorites()
  }, [load, refreshFavorites])

  const error = validateJson(text)
  const dirty = text !== baseline

  async function saveToStation() {
    if (error || !text.trim()) return
    // POST only the changed keys, flat + stringified — the shape the live API accepts.
    const patch = configDiff(
      JSON.parse(baseline || '{}') as Record<string, unknown>,
      JSON.parse(text) as Record<string, unknown>
    )
    if (!Object.keys(patch).length) {
      setNote({ tone: 'good', msg: 'No changes to save.' })
      setTimeout(() => setNote(null), 2500)
      return
    }
    const res = await api.request({
      endpointId: 'station.config.set',
      params: { stationId, ...CONFIG_WRITE_PARAMS },
      body: patch
    })
    setNote(res.ok ? { tone: 'good', msg: 'Saved to station.' } : { tone: 'bad', msg: res.error?.message ?? `HTTP ${res.status}` })
    if (res.ok) setBaseline(text)
    setTimeout(() => setNote(null), 2500)
  }

  async function saveFavorite() {
    if (error || !favName.trim()) return
    await api.savePreset({ kind: 'config', name: favName.trim(), data: JSON.parse(text) })
    setFavName('')
    await refreshFavorites()
  }

  /** Shallow-merge a favorite's keys over the current config (same as LE injection). */
  function inject(p: Preset) {
    try {
      const current = JSON.parse(text || '{}') as Record<string, unknown>
      const patch = (typeof p.data === 'object' && p.data !== null ? p.data : {}) as Record<string, unknown>
      setText(prettyJson({ ...current, ...patch }))
    } catch {
      setNote({ tone: 'bad', msg: 'Current text is not valid JSON — fix it before injecting.' })
      setTimeout(() => setNote(null), 2500)
    }
  }

  async function removeFavorite(p: Preset) {
    await api.deletePreset(p.id)
    await refreshFavorites()
  }

  function importFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setText(String(reader.result))
    reader.readAsText(file)
    e.target.value = ''
  }

  function exportFile() {
    const blob = new Blob([text], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `config-${stationId}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-4">
      <Card className="grid gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {error ? (
            <Badge tone="bad"><AlertCircle size={11} /> {error}</Badge>
          ) : (
            <Badge tone="good"><CheckCircle2 size={11} /> valid JSON</Badge>
          )}
          {dirty ? <Badge tone="warn">unsaved changes</Badge> : <Badge>matches station</Badge>}
          {note && <Badge tone={note.tone}>{note.msg}</Badge>}
          <div className="ml-auto flex gap-2 flex-wrap">
            <Button onClick={() => void load()} disabled={loading}>
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Reload
            </Button>
            <label className="btn cursor-pointer">
              <Upload size={14} /> Import
              <input type="file" accept=".json" hidden onChange={importFile} />
            </label>
            <Button onClick={exportFile}><Download size={14} /> Export</Button>
            <Button onClick={() => setShowDiff((v) => !v)}>
              <GitCompare size={14} /> {showDiff ? 'Edit' : 'Diff'}
            </Button>
            <Button disabled={!dirty} onClick={() => setText(baseline)}>
              <RotateCcw size={14} /> Rollback
            </Button>
            <PermissionGate scope="station_config:write">
              <Button variant="primary" disabled={!!error || !dirty} onClick={() => void saveToStation()}>
                <Save size={14} /> Save to station
              </Button>
            </PermissionGate>
          </div>
        </div>

        {showDiff ? (
          <JsonDiff original={baseline} modified={text} height={460} />
        ) : (
          <JsonEditor value={text} onChange={setText} height={460} />
        )}
      </Card>

      <Card className="grid gap-3 content-start">
        <div className="font-medium text-[13px] flex items-center gap-2">
          <Star size={14} className="text-[var(--warn)]" /> Config Library
        </div>
        <p className="text-[11px] text-[var(--text-dim)]">
          Favorite config snippets. Inject merges a favorite&apos;s keys over the current config.
        </p>
        <div className="flex gap-2">
          <input
            className="input flex-1 text-[12px]"
            placeholder="Save current as favorite…"
            value={favName}
            onChange={(e) => setFavName(e.target.value)}
          />
          <Button variant="primary" disabled={!!error || !favName.trim()} onClick={() => void saveFavorite()}>
            <Save size={13} />
          </Button>
        </div>
        {favorites.length === 0 ? (
          <EmptyState title="No favorites yet" hint="Save the current config under a name to reuse it anywhere." />
        ) : (
          <div className="grid gap-1.5">
            {favorites.map((p) => (
              <div key={p.id} className="flex items-center gap-1.5 text-[12px] rounded-lg px-2 py-1.5 bg-[var(--bg-elev-2)]">
                <span className="flex-1 truncate" title={p.name}>{p.name}</span>
                <Button variant="ghost" title="Inject into current config" onClick={() => inject(p)}>
                  <ArrowDownToLine size={13} />
                </Button>
                <Button variant="ghost" title="Delete favorite" onClick={() => void removeFavorite(p)}>
                  <Trash2 size={13} />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
