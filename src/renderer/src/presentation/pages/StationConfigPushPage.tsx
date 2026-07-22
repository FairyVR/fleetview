import { useMemo, useState } from 'react'
import { Layers, RefreshCw, Send, Server, AlertTriangle } from 'lucide-react'
import { api } from '../../lib/api'
import { useEndpoint } from '../../services/useEndpoint'
import { useAppStore } from '../../state/useAppStore'
import { PageHeader, Card, Button, Badge, Field, EmptyState } from '../components/ui'
import { RequestResult } from '../components/RequestResult'
import { PermissionGate } from '../components/PermissionGate'
import { FleetScoped } from '../components/FleetScoped'
import { Modal } from '../components/Modal'
import { CONFIG_WRITE_PARAMS, parseConfigPatch } from '../../lib/stationConfig'

interface Stn {
  id: string
  name: string
  online: boolean
}

/** Same coercion the Station Manager uses; the stations list wrapper shape varies. */
function asStations(data: unknown): Stn[] {
  const d = data as { items?: unknown[]; stations?: unknown[] } | unknown[]
  const arr = Array.isArray(d) ? d : (d?.items ?? d?.stations ?? [])
  return (arr as Record<string, unknown>[])
    .map((s) => ({
      id: String(s.station_id ?? s.id ?? ''),
      name: String(s.station_name ?? s.name ?? s.station_id ?? 'Unnamed station'),
      online: s.disabled === true ? false : s.online === true
    }))
    .filter((s) => s.id)
}

type PushRow = { id: string; name: string; ok: boolean; msg?: string }

export default function StationConfigPushPage() {
  return (
    <div>
      <PageHeader
        title="Config Push"
        subtitle="Apply one station-config patch to several stations at once — set the same gamemode, whitelist, or board on every arena in a fleet."
      />
      <FleetScoped>{(fleetId) => <Pusher fleetId={fleetId} />}</FleetScoped>
    </div>
  )
}

function Pusher({ fleetId }: { fleetId: string }) {
  const showIds = useAppStore((s) => s.settings?.showIds ?? false)
  const { response, loading, run } = useEndpoint('fleet.stations', {
    params: { fleetId },
    auto: true
  })
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [patchText, setPatchText] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pushing, setPushing] = useState(false)
  const [results, setResults] = useState<PushRow[] | null>(null)

  const stations = useMemo(() => asStations(response?.data), [response?.data])
  const parsed = parseConfigPatch(patchText)
  const patch = 'patch' in parsed ? parsed.patch : null
  const patchError = 'error' in parsed ? parsed.error : null
  const canPush = selected.size > 0 && !!patch

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function push() {
    if (!patch) return
    const targets = stations.filter((s) => selected.has(s.id))
    setPushing(true)
    setResults(null)
    const rows: PushRow[] = []
    // Sequential apply — one station at a time, each with its own result, mirroring the
    // per-row feedback of the role assignment flow.
    for (const s of targets) {
      const res = await api.request({
        endpointId: 'station.config.set',
        params: { stationId: s.id, ...CONFIG_WRITE_PARAMS },
        body: patch
      })
      rows.push({
        id: s.id,
        name: s.name,
        ok: res.ok,
        msg: res.ok ? undefined : res.error?.message ?? `HTTP ${res.status}`
      })
      setResults([...rows])
    }
    setPushing(false)
    setConfirmOpen(false)
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_1fr] gap-4 items-start">
      {/* ---- station picker ---- */}
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <Server size={15} className="text-[var(--accent)]" />
          <span className="font-medium">Target stations</span>
          <Badge tone="accent">{selected.size} selected</Badge>
          <Button className="ml-auto" onClick={() => void run()} disabled={loading}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Reload
          </Button>
        </div>
        <RequestResult response={response} loading={loading} onRetry={() => void run()}>
          {() =>
            stations.length === 0 ? (
              <EmptyState title="No stations" hint="This fleet has no stations to target." />
            ) : (
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-[12px] text-[var(--text-dim)] cursor-pointer pb-2 border-b border-[var(--border-soft)]">
                  <input
                    type="checkbox"
                    checked={selected.size === stations.length && stations.length > 0}
                    onChange={(e) => setSelected(e.target.checked ? new Set(stations.map((s) => s.id)) : new Set())}
                  />
                  Select all ({stations.length})
                </label>
                {stations.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 text-[13px] cursor-pointer">
                    <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} />
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${s.online ? 'bg-[var(--good,#34d399)]' : 'bg-[var(--text-faint)]'}`}
                    />
                    <span>{s.name}</span>
                    {showIds && <span className="mono text-[11px] text-[var(--text-faint)] ml-auto">{s.id}</span>}
                  </label>
                ))}
              </div>
            )
          }
        </RequestResult>
      </Card>

      {/* ---- patch editor + push ---- */}
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <Layers size={15} className="text-[var(--accent)]" />
          <span className="font-medium">Config patch</span>
        </div>
        <Field label="Flat dotted-key JSON — only the keys you want to change">
          <textarea
            className="input mono text-[12px]"
            rows={10}
            spellCheck={false}
            placeholder={'{\n  "is_whitelist": true,\n  "config.stationConfig.BoardTextureUrl0": "https://…/a.png"\n}'}
            value={patchText}
            onChange={(e) => setPatchText(e.target.value)}
          />
        </Field>
        {patchError && patchText.trim() !== '' && (
          <p className="text-[12px] text-[var(--bad)] mt-1">{patchError}</p>
        )}
        {patch && (
          <p className="text-[12px] text-[var(--text-dim)] mt-1">
            {Object.keys(patch).length} key{Object.keys(patch).length === 1 ? '' : 's'} · applies to{' '}
            {selected.size} station{selected.size === 1 ? '' : 's'}
          </p>
        )}

        <div className="mt-4">
          <PermissionGate scope="station_config:write">
            <Button variant="primary" disabled={!canPush || pushing} onClick={() => setConfirmOpen(true)}>
              <Send size={13} /> Push to {selected.size} station{selected.size === 1 ? '' : 's'}
            </Button>
          </PermissionGate>
        </div>

        {results && (
          <div className="grid gap-1 mt-4">
            {results.map((r) => (
              <div key={r.id} className="flex items-center gap-2 text-[12px]">
                <Badge tone={r.ok ? 'good' : 'bad'}>{r.ok ? 'ok' : 'failed'}</Badge>
                <span>{r.name}</span>
                {r.msg && <span className="text-[var(--text-dim)]">{r.msg}</span>}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal
        open={confirmOpen}
        title="Push config to multiple stations?"
        onClose={() => setConfirmOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button variant="danger" onClick={() => void push()} disabled={pushing}>
              <Send size={13} /> {pushing ? 'Pushing…' : `Push to ${selected.size}`}
            </Button>
          </>
        }
      >
        <div className="flex items-start gap-2 text-[13px]">
          <AlertTriangle size={16} className="text-[var(--warn,#fbbf24)] shrink-0 mt-0.5" />
          <div className="space-y-2">
            <p className="text-[var(--text-dim)]">
              This writes {patch ? Object.keys(patch).length : 0} config key
              {patch && Object.keys(patch).length === 1 ? '' : 's'} to{' '}
              <strong>{selected.size}</strong> live station{selected.size === 1 ? '' : 's'}. Each
              station is updated in turn; changes take effect immediately in-game.
            </p>
            <div className="flex flex-wrap gap-1">
              {stations.filter((s) => selected.has(s.id)).map((s) => (
                <Badge key={s.id}>{s.name}</Badge>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
