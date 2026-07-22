import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Radio, RefreshCw, Server, Users, Globe, ChevronRight } from 'lucide-react'
import { useEndpoint } from '../../services/useEndpoint'
import { useSelectionStore } from '../../state/useSelectionStore'
import { useAppStore } from '../../state/useAppStore'
import { PageHeader, Card, Button, Badge } from '../components/ui'
import { RequestResult } from '../components/RequestResult'
import { regionLabel } from '../../lib/format'

interface LiveStation {
  id: string
  name: string
  region?: string
  online: boolean
  players?: number
  version?: string
  fleetId?: string
  fleetName?: string
}

/** Coerce the global /v2/stations telemetry (unknown wrapper shape) into display rows. */
function asStations(data: unknown): LiveStation[] {
  const d = data as { items?: unknown[]; stations?: unknown[] } | unknown[]
  const arr = Array.isArray(d) ? d : (d?.items ?? d?.stations ?? [])
  return (arr as Record<string, unknown>[]).map((s) => {
    const players = [s.player_count, s.players, s.playerCount].find((v) => typeof v === 'number') as
      | number
      | undefined
    return {
      id: String(s.station_id ?? s.id ?? ''),
      name: String(s.station_name ?? s.name ?? s.station_id ?? 'Unnamed station'),
      region: (s.region as string | undefined) ?? undefined,
      online: s.online === true || (typeof players === 'number' && players > 0),
      players,
      version: s.version != null ? String(s.version) : undefined,
      fleetId: (s.fleet_id ?? s.fleetId) as string | undefined,
      fleetName: (s.fleet_name ?? s.fleetName) as string | undefined
    }
  })
}

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: string | number }) {
  return (
    <Card className="flex items-center gap-3 py-3">
      <div className="w-9 h-9 rounded-lg grid place-items-center bg-[var(--bg-elev-2)] text-[var(--accent)]">
        {icon}
      </div>
      <div>
        <div className="text-[18px] font-semibold leading-none">{value}</div>
        <div className="text-[11px] text-[var(--text-dim)] mt-1">{label}</div>
      </div>
    </Card>
  )
}

export default function LiveOpsPage() {
  const { response, loading, run } = useEndpoint('station.list', {
    params: { page_size: 200, page: 1 },
    auto: true
  })
  const showIds = useAppStore((s) => s.settings?.showIds ?? false)
  const selectFleet = useSelectionStore((s) => s.selectFleet)
  const selectStation = useSelectionStore((s) => s.selectStation)
  const navigate = useNavigate()

  const [onlineOnly, setOnlineOnly] = useState(true)
  const [query, setQuery] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(false)

  // Optional 10s auto-poll — a desktop-only convenience for keeping an ops board live.
  useEffect(() => {
    if (!autoRefresh) return
    const t = setInterval(() => void run(), 10_000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh])

  const stations = useMemo(() => asStations(response?.data), [response?.data])
  const onlineCount = stations.filter((s) => s.online).length
  const totalPlayers = stations.reduce((sum, s) => sum + (s.players ?? 0), 0)
  const regions = new Set(stations.filter((s) => s.region).map((s) => s.region)).size

  function openStation(s: LiveStation) {
    if (!s.fleetId) return
    selectFleet(s.fleetId, s.fleetName ?? null)
    selectStation(s.id, s.name)
    navigate('/gamemodes')
  }

  const visible = stations
    .filter((s) => !onlineOnly || s.online)
    .filter((s) => {
      const q = query.trim().toLowerCase()
      return !q || s.name.toLowerCase().includes(q) || (s.fleetName ?? '').toLowerCase().includes(q)
    })
    .sort((a, b) => Number(b.online) - Number(a.online) || (b.players ?? 0) - (a.players ?? 0))

  return (
    <div>
      <PageHeader
        title="Live Ops"
        subtitle="Every server across all fleets in one view — live player counts, regions, and versions."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant={autoRefresh ? 'primary' : 'ghost'}
              onClick={() => setAutoRefresh((v) => !v)}
              title="Auto-refresh every 10s"
            >
              <Radio size={14} /> {autoRefresh ? 'Live' : 'Go live'}
            </Button>
            <Button onClick={() => void run()}>
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Stat icon={<Server size={16} />} label="online servers" value={onlineCount} />
        <Stat icon={<Users size={16} />} label="players in-game" value={totalPlayers} />
        <Stat icon={<Globe size={16} />} label="regions" value={regions} />
        <Stat icon={<Server size={16} />} label="stations total" value={stations.length} />
      </div>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <input
          className="input flex-1 min-w-[200px]"
          placeholder="Filter by station or fleet name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <label className="flex items-center gap-2 text-[12px] text-[var(--text-dim)] cursor-pointer select-none">
          <input type="checkbox" checked={onlineOnly} onChange={(e) => setOnlineOnly(e.target.checked)} />
          Online only
        </label>
      </div>

      <RequestResult response={response} loading={loading} onRetry={() => void run()}>
        {() =>
          visible.length === 0 ? (
            <Card className="text-[13px] text-[var(--text-dim)]">
              No {onlineOnly ? 'online ' : ''}stations match.
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {visible.map((s) => (
                <button
                  key={s.id}
                  onClick={() => openStation(s)}
                  disabled={!s.fleetId}
                  className="card p-4 text-left enabled:hover:border-[var(--accent-2)] transition-colors disabled:cursor-default"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${s.online ? 'bg-[var(--good,#34d399)]' : 'bg-[var(--text-faint)]'}`}
                      />
                      <div className="min-w-0">
                        <div className="font-medium truncate">{s.name}</div>
                        {s.fleetName && <div className="text-[11px] text-[var(--text-dim)] truncate">{s.fleetName}</div>}
                        {showIds && <div className="text-[11px] text-[var(--text-faint)] mono truncate">{s.id}</div>}
                      </div>
                    </div>
                    {s.fleetId && <ChevronRight size={16} className="text-[var(--text-faint)] shrink-0" />}
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    <Badge tone={s.online ? 'good' : 'neutral'}>{s.online ? 'online' : 'offline'}</Badge>
                    {s.players != null && <Badge tone="accent"><Users size={10} /> {s.players}</Badge>}
                    {s.region && <Badge>{regionLabel(s.region)}</Badge>}
                    {s.version && <Badge>v{s.version}</Badge>}
                  </div>
                </button>
              ))}
            </div>
          )
        }
      </RequestResult>
    </div>
  )
}
