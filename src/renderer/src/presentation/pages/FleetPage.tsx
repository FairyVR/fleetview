import { useNavigate } from 'react-router-dom'
import { Rocket, RefreshCw, ChevronRight } from 'lucide-react'
import type { Fleet } from '@shared/models'
import { useEndpoint } from '../../services/useEndpoint'
import { useSelectionStore } from '../../state/useSelectionStore'
import { useAppStore } from '../../state/useAppStore'
import { PageHeader, Button, Badge } from '../components/ui'
import { RequestResult } from '../components/RequestResult'
import { regionLabel } from '../../lib/format'

/** Real API returns fleets with fleet_id/fleet_name and an embedded stations array. */
function asFleets(data: unknown): Fleet[] {
  const d = data as { fleets?: unknown[]; items?: unknown[] } | unknown[]
  const arr = Array.isArray(d) ? d : (d?.fleets ?? d?.items ?? [])
  return (arr as Record<string, unknown>[]).map((f) => ({
    id: String(f.fleet_id ?? f.id ?? ''),
    name: String(f.fleet_name ?? f.name ?? f.fleet_id ?? 'Unnamed fleet'),
    description: f.description as string | undefined,
    region: f.region as string | undefined,
    stationCount: Array.isArray(f.stations) ? f.stations.length : (f.station_count as number | undefined),
    permissionLevel: Array.isArray(f.permissions)
      ? (f.permissions as string[]).includes('admin') ? 'admin' : (f.permissions as string[]).join(', ')
      : undefined,
    raw: f
  }))
}

export default function FleetPage() {
  const { response, loading, run } = useEndpoint('fleet.list', {
    params: {
      include_stations: true,
      include_config: true,
      include_offline_fleets: false,
      page_size: 32,
      page: 1
    },
    auto: true
  })
  const grants = useAppStore((s) => s.permissions.grants ?? {})
  const showIds = useAppStore((s) => s.settings?.showIds ?? false)
  const selectFleet = useSelectionStore((s) => s.selectFleet)
  const navigate = useNavigate()

  // Probed scopes beyond the fleet:read baseline = the key actually works in this fleet.
  const accessScopes = (fleetId: string): string[] => {
    const scopes = grants[fleetId] ?? []
    // admin = all scopes; showing anything else alongside it is noise
    return scopes.includes('admin') ? ['admin'] : scopes.filter((s) => s !== 'fleet:read')
  }

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
          // fleet.list already returns only fleets the key can reach, and probed grants are
          // advisory (a transient probe failure must never HIDE a fleet — that was the old
          // bug). So show every returned fleet; just sort the ones with confirmed station
          // access to the top and badge the rest as unprobed.
          const usable = (id: string): boolean =>
            (grants[id] ?? []).some((s) => s === 'station:read' || s === 'admin')
          const fleets = asFleets(raw).sort(
            (a, b) => Number(usable(b.id)) - Number(usable(a.id))
          )
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
                        {showIds && <div className="text-[11px] text-[var(--text-faint)] mono">{f.id}</div>}
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-[var(--text-faint)]" />
                  </div>
                  {f.description && <p className="text-[12px] text-[var(--text-dim)] mt-2">{f.description}</p>}
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {f.region && <Badge>{regionLabel(f.region)}</Badge>}
                    {f.stationCount != null && <Badge tone="accent">{f.stationCount} stations</Badge>}
                    {f.permissionLevel && <Badge tone="good">{f.permissionLevel}</Badge>}
                    {accessScopes(f.id).length > 0 ? (
                      <Badge tone="good">access · {accessScopes(f.id).join(', ')}</Badge>
                    ) : (
                      Object.keys(grants).length > 0 && <Badge tone="neutral">access not probed</Badge>
                    )}
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
