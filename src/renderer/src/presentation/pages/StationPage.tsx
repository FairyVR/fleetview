import { useState, useEffect } from 'react'
import { RefreshCw, Server, Users, Cpu, CheckCircle2, Save, Braces } from 'lucide-react'
import type { Station } from '@shared/models'
import { api } from '../../lib/api'
import { useEndpoint } from '../../services/useEndpoint'
import { useSelectionStore } from '../../state/useSelectionStore'
import { useAppStore } from '../../state/useAppStore'
import { PageHeader, Card, Button, Badge, StatusDot, EmptyState } from '../components/ui'
import { RequestResult } from '../components/RequestResult'
import { PermissionGate } from '../components/PermissionGate'
import { JsonEditor, validateJson } from '../components/JsonEditor'
import { configDiff, CONFIG_WRITE_PARAMS } from '../../lib/stationConfig'
import { regionLabel } from '../../lib/format'
import { useNavigate } from 'react-router-dom'
import { Rocket } from 'lucide-react'

/**
 * The `online` flag from /v2/fleets/:id/stations is unreliable (live-verified: it reports
 * false for stations whose last_event is seconds old). Treat a station as online unless
 * it's disabled or genuinely silent for a while.
 */
function isOnline(s: Record<string, unknown>): boolean {
  if (s.disabled === true) return false
  if (s.online === true) return true
  const last = typeof s.last_event === 'string' ? Date.parse(s.last_event) : NaN
  if (!Number.isNaN(last)) return Date.now() - last < 10 * 60 * 1000
  return true
}

function asStations(data: unknown, fleetId: string): Station[] {
  const d = data as
    | { items?: unknown[]; fleet?: { stations?: unknown[] }; stations?: unknown[] }
    | unknown[]
  const arr = Array.isArray(d) ? d : (d?.items ?? d?.fleet?.stations ?? d?.stations ?? [])
  return (arr as Record<string, unknown>[]).map((s) => ({
    id: String(s.station_id ?? s.id ?? ''),
    fleetId,
    name: String(s.station_name ?? s.name ?? s.station_id ?? 'Unnamed station'),
    region: s.region as string | undefined,
    status: isOnline(s) ? 'online' : 'offline',
    version: s.version as string | undefined,
    sessionId: (s.session_id ?? s.sessionId) as string | undefined,
    playerCount: (s.player_count ?? s.playerCount) as number | undefined,
    raw: s
  }))
}

export default function StationPage() {
  const { fleetId, fleetName, stationId, selectStation } = useSelectionStore()
  const showIds = useAppStore((s) => s.settings?.showIds ?? false)
  const navigate = useNavigate()
  const { response, loading, run } = useEndpoint('fleet.stations', {
    params: fleetId ? { fleetId } : undefined,
    auto: !!fleetId,
    enabled: !!fleetId
  })

  if (!fleetId) {
    return (
      <div>
        <PageHeader title="Station Manager" subtitle="Select a fleet first to load its stations." />
        <Card>
          <EmptyState
            icon={<Rocket size={22} />}
            title="No fleet selected"
            hint="Pick a fleet in the Fleet Explorer."
            action={<Button variant="primary" onClick={() => navigate('/fleets')}>Go to Fleet Explorer</Button>}
          />
        </Card>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Station Manager"
        subtitle={`Stations in ${fleetName ?? fleetId}. Select one to enable board, gamemode, events, and match modules.`}
        actions={<Button onClick={() => void run()}><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh</Button>}
      />
      <RequestResult response={response} loading={loading} onRetry={() => void run()}>
        {(raw) => {
          const stations = asStations(raw, fleetId)
          return (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {stations.map((s) => (
                <Card key={s.id} className={s.id === stationId ? 'border-[var(--accent-2)]' : ''}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Server size={15} className="text-[var(--accent)]" />
                      <div>
                        <div className="font-medium">{s.name}</div>
                        {showIds && <div className="text-[11px] text-[var(--text-faint)] mono">{s.id}</div>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <StatusDot status={s.status === 'online' ? 'good' : s.status === 'offline' ? 'bad' : 'idle'} />
                      <span className="text-[11px] text-[var(--text-dim)]">{s.status}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {s.region && <Badge>{regionLabel(s.region)}</Badge>}
                    {s.version && <Badge><Cpu size={10} /> {s.version}</Badge>}
                    {s.playerCount != null && <Badge tone="accent"><Users size={10} /> {s.playerCount}</Badge>}
                  </div>
                  <div className="mt-3">
                    <Button
                      variant={s.id === stationId ? 'default' : 'primary'}
                      onClick={() => selectStation(s.id, s.name)}
                      className="w-full justify-center"
                    >
                      <CheckCircle2 size={14} /> {s.id === stationId ? 'Selected' : 'Select station'}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )
        }}
      </RequestResult>

      {stationId && <StationConfigJson key={stationId} stationId={stationId} />}
    </div>
  )
}

/** Raw, editable view of the selected station's config JSON — the power-user path. */
function StationConfigJson({ stationId }: { stationId: string }) {
  const { response, loading, run } = useEndpoint<unknown>('station.config.get', {
    params: { stationId },
    auto: true
  })
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState<{ tone: 'good' | 'bad'; msg: string } | null>(null)

  useEffect(() => {
    if (response?.data !== undefined && response?.ok) {
      const cfg = (response.data as { config?: unknown } | null)?.config ?? response.data
      setText(JSON.stringify(cfg ?? {}, null, 2))
    }
  }, [response])

  const invalid = validateJson(text)

  async function save() {
    if (invalid || !text.trim()) return
    setSaving(true)
    setNote(null)
    try {
      // POST only the changed keys, flat + stringified — the shape the live API accepts.
      const cfg = (response?.data as { config?: unknown } | null)?.config ?? response?.data
      const baseline = typeof cfg === 'object' && cfg !== null ? (cfg as Record<string, unknown>) : {}
      const patch = configDiff(baseline, JSON.parse(text) as Record<string, unknown>)
      if (!Object.keys(patch).length) {
        setNote({ tone: 'good', msg: 'No changes to save.' })
        return
      }
      const res = await api.request({
        endpointId: 'station.config.set',
        params: { stationId, ...CONFIG_WRITE_PARAMS },
        body: patch
      })
      setNote(res.ok ? { tone: 'good', msg: 'Config saved.' } : { tone: 'bad', msg: res.error?.message ?? `HTTP ${res.status}` })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="mt-4">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <Braces size={15} className="text-[var(--accent)]" />
        <span className="font-medium text-[13px]">Station config (raw JSON)</span>
        {invalid && <Badge tone="bad">{invalid}</Badge>}
        {note && <Badge tone={note.tone}>{note.msg}</Badge>}
        <div className="flex-1" />
        <Button onClick={() => void run()} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Reload
        </Button>
        <PermissionGate scope="station_config:write">
          <Button variant="primary" onClick={() => void save()} disabled={!!invalid || saving || loading}>
            <Save size={13} /> Save JSON
          </Button>
        </PermissionGate>
      </div>
      <RequestResult response={response} loading={loading} onRetry={() => void run()}>
        {() => <JsonEditor value={text} onChange={setText} height={380} />}
      </RequestResult>
    </Card>
  )
}
