import { useNavigate } from 'react-router-dom'
import { Rocket, RefreshCw, ChevronRight } from 'lucide-react'
import type { Fleet } from '@shared/models'
import { useEndpoint } from '../../services/useEndpoint'
import { useSelectionStore } from '../../state/useSelectionStore'
import { PageHeader, Button, Badge } from '../components/ui'
import { RequestResult } from '../components/RequestResult'

function asFleets(data: unknown): Fleet[] {
  const arr = Array.isArray(data) ? data : (data as { fleets?: unknown[] })?.fleets ?? []
  return (arr as Record<string, unknown>[]).map((f) => ({
    id: String(f.id ?? f.fleetId ?? ''),
    name: String(f.name ?? f.id ?? 'Unnamed fleet'),
    description: f.description as string | undefined,
    region: f.region as string | undefined,
    stationCount: f.stationCount as number | undefined,
    permissionLevel: f.permissionLevel as string | undefined,
    raw: f
  }))
}

export default function FleetPage() {
  const { response, loading, run } = useEndpoint('fleet.list', { auto: true })
  const selectFleet = useSelectionStore((s) => s.selectFleet)
  const navigate = useNavigate()

  function open(f: Fleet) {
    selectFleet(f.id, f.name)
    navigate('/stations')
  }

  return (
    <div>
      <PageHeader
        title="Fleet Explorer"
        subtitle="Every fleet the active key can access. Select one to load its stations."
        actions={<Button onClick={() => void run()}><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh</Button>}
      />
      <RequestResult response={response} loading={loading} onRetry={() => void run()}>
        {(raw) => {
          const fleets = asFleets(raw)
          return (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {fleets.map((f) => (
                <button key={f.id} onClick={() => open(f)} className="card p-4 text-left hover:border-[var(--accent-2)] transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg grid place-items-center bg-[var(--bg-elev-2)]">
                        <Rocket size={15} className="text-[var(--accent)]" />
                      </div>
                      <div>
                        <div className="font-medium">{f.name}</div>
                        <div className="text-[11px] text-[var(--text-faint)] mono">{f.id}</div>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-[var(--text-faint)]" />
                  </div>
                  {f.description && <p className="text-[12px] text-[var(--text-dim)] mt-2">{f.description}</p>}
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {f.region && <Badge>{f.region}</Badge>}
                    {f.stationCount != null && <Badge tone="accent">{f.stationCount} stations</Badge>}
                    {f.permissionLevel && <Badge tone="good">{f.permissionLevel}</Badge>}
                  </div>
                </button>
              ))}
            </div>
          )
        }}
      </RequestResult>
    </div>
  )
}
