import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Rocket, RefreshCw, ChevronRight } from 'lucide-react'
import type { Fleet } from '@shared/models'
import { useEndpoint } from '../../services/useEndpoint'
import { useSelectionStore } from '../../state/useSelectionStore'
import { useAppStore } from '../../state/useAppStore'
import { PageHeader, Button, Badge, EmptyState, FilterToggle } from '../components/ui'
import { RequestResult } from '../components/RequestResult'
import { regionLabel } from '../../lib/format'
import { accessLabel, fleetAccess, isManageable, sortByAccess } from '../../lib/fleetAccess'

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
    // `online` is a station field — a fleet is only as online as its stations.
    onlineStationCount: Array.isArray(f.stations)
      ? (f.stations as Record<string, unknown>[]).filter((s) => s.online === true).length
      : undefined,
    permissionLevel: Array.isArray(f.permissions)
      ? (f.permissions as string[]).includes('admin') ? 'admin' : (f.permissions as string[]).join(', ')
      : undefined,
    raw: f
  }))
}

export default function FleetPage() {
  const [manageableOnly, setManageableOnly] = useState(false)
  const [includeOffline, setIncludeOffline] = useState(false)
  const { response, loading, run } = useEndpoint('fleet.list', {
    // The offline switch is a server-side filter — flipping it re-runs the request.
    params: {
      include_stations: true,
      include_config: true,
      include_offline_fleets: includeOffline,
      page_size: 32,
      page: 1
    },
    auto: true
  })
  const grants = useAppStore((s) => s.permissions.grants ?? {})
  const showIds = useAppStore((s) => s.settings?.showIds ?? false)
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
        actions={
          <>
            <FilterToggle on={manageableOnly} onClick={() => setManageableOnly((v) => !v)}>
              Manageable only
            </FilterToggle>
            <FilterToggle on={includeOffline} onClick={() => setIncludeOffline((v) => !v)}>
              Include offline
            </FilterToggle>
            <Button onClick={() => void run()}>
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
            </Button>
          </>
        }
      />
      <RequestResult response={response} loading={loading} onRetry={() => void run()}>
        {(raw) => {
          // fleet.list already returns only fleets the key can reach, and probed grants are
          // advisory (a transient probe failure must never HIDE a fleet — that was the old
          // bug). So show every returned fleet; just sort the manage-capable ones to the top
          // and badge the rest by what was actually confirmed.
          const all = sortByAccess(asFleets(raw), grants)
          const fleets = manageableOnly ? all.filter((f) => isManageable(grants[f.id])) : all
          if (fleets.length === 0) {
            return (
              <EmptyState
                icon={<Rocket size={22} />}
                title="No fleets match these filters"
                hint={`${all.length} fleet${all.length === 1 ? '' : 's'} hidden by "Manageable only". Probe a key's access from the API Keys tab to classify more of them.`}
                action={<Button onClick={() => setManageableOnly(false)}>Show all fleets</Button>}
              />
            )
          }
          return (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {fleets.map((f) => (
                <button key={f.id} onClick={() => open(f)} className="card card-interactive p-4 text-left">
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
                    {f.stationCount != null && (
                      <Badge tone="accent">
                        {f.onlineStationCount != null
                          ? `${f.onlineStationCount}/${f.stationCount} online`
                          : `${f.stationCount} stations`}
                      </Badge>
                    )}
                    {f.onlineStationCount === 0 && <Badge tone="warn">offline</Badge>}
                    {/* Server-declared permissions when present — authoritative, unlike probes. */}
                    {f.permissionLevel && <Badge tone="good">{f.permissionLevel}</Badge>}
                    {(() => {
                      const a = fleetAccess(grants[f.id])
                      if (a.tier === 'unknown' && !Object.keys(grants).length) return null
                      return (
                        <Badge tone={a.tier === 'admin' || a.tier === 'elevated' ? 'good' : 'neutral'}>
                          {accessLabel(a)}
                        </Badge>
                      )
                    })()}
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
