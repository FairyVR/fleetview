import { RefreshCw, Server, Users, Cpu, CheckCircle2 } from 'lucide-react'
import type { Station } from '@shared/models'
import { useEndpoint } from '../../services/useEndpoint'
import { useSelectionStore } from '../../state/useSelectionStore'
import { PageHeader, Card, Button, Badge, StatusDot, EmptyState } from '../components/ui'
import { RequestResult } from '../components/RequestResult'
import { useNavigate } from 'react-router-dom'
import { Rocket } from 'lucide-react'

/**
 * There is no "list stations" endpoint — stations are embedded in the fleet object
 * (GET /v1/fleets/{fleet_id} -> fleet.stations[]).
 */
function asStations(data: unknown, fleetId: string): Station[] {
  const d = data as { fleet?: { stations?: unknown[] }; stations?: unknown[] } | unknown[]
  const arr = Array.isArray(d) ? d : (d?.fleet?.stations ?? d?.stations ?? [])
  return (arr as Record<string, unknown>[]).map((s) => ({
    id: String(s.station_id ?? s.id ?? ''),
    fleetId,
    name: String(s.station_name ?? s.name ?? s.station_id ?? 'Unnamed station'),
    region: s.region as string | undefined,
    status: s.online === true ? 'online' : s.online === false ? 'offline' : 'unknown',
    version: s.version as string | undefined,
    sessionId: (s.session_id ?? s.sessionId) as string | undefined,
    playerCount: (s.player_count ?? s.playerCount) as number | undefined,
    raw: s
  }))
}

export default function StationPage() {
  const { fleetId, fleetName, stationId, selectStation } = useSelectionStore()
  const navigate = useNavigate()
  const { response, loading, run } = useEndpoint('fleet.get', {
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
                        <div className="text-[11px] text-[var(--text-faint)] mono">{s.id}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <StatusDot status={s.status === 'online' ? 'good' : s.status === 'offline' ? 'bad' : 'idle'} />
                      <span className="text-[11px] text-[var(--text-dim)]">{s.status}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {s.region && <Badge>{s.region}</Badge>}
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
    </div>
  )
}
