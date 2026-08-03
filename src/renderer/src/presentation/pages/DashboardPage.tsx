import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  KeyRound,
  ShieldCheck,
  Rocket,
  Server,
  Radar,
  AlertTriangle,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Users,
  Cpu,
  Gavel,
  Flag,
  Activity
} from 'lucide-react'
import { useAppStore } from '../../state/useAppStore'
import { useSelectionStore } from '../../state/useSelectionStore'
import { useEndpoint } from '../../services/useEndpoint'
import { api } from '../../lib/api'
import { ago, regionLabel } from '../../lib/format'
import { stationPlayerCounts } from '../../lib/presence'
import {
  activeBanCount,
  asOverviewStations,
  recentActivity,
  reportCount,
  summarizeFleet
} from '../../lib/fleetOverview'
import { PageHeader, Card, Button, Badge, StatusDot, EmptyState, Spinner } from '../components/ui'

const POLL_CHOICES = [
  { value: 0, label: 'Off' },
  { value: 10, label: '10s' },
  { value: 30, label: '30s' },
  { value: 60, label: '60s' }
]

export default function DashboardPage() {
  const { keys, activeKeyId, permissions, settings, discoverActive, updateSettings } = useAppStore()
  const { fleetId, fleetName } = useSelectionStore()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [showAllGrants, setShowAllGrants] = useState(false)
  const active = keys.find((k) => k.id === activeKeyId)
  const placeholderBase = settings?.baseUrl.includes('example')
  const pollSeconds = settings?.overviewPollSeconds ?? 0

  const [libCount, setLibCount] = useState(0)
  useEffect(() => {
    void api.listLeConfigs().then((c) => setLibCount(c.length))
  }, [])

  async function discover() {
    setBusy(true)
    await discoverActive()
    setBusy(false)
  }

  const allGrants = Object.entries(permissions.grants ?? {})
  // Only fleets with more than bare fleet:read are worth listing here.
  const grants = allGrants.filter(([, scopes]) => scopes.some((s) => s !== 'fleet:read'))
  // Fleet names live in the raw fleet list kept alongside the discovered grants.
  const fleetNames: Record<string, string> = {}
  for (const f of (permissions.raw as { items?: unknown[] } | null)?.items ?? []) {
    const o = f as Record<string, unknown>
    if (typeof o.fleet_id === 'string' && typeof o.fleet_name === 'string') fleetNames[o.fleet_id] = o.fleet_name
  }
  const currentScopes = (fleetId && permissions.grants?.[fleetId]) || []

  return (
    <div className="max-w-6xl">
      <PageHeader
        title="Overview"
        subtitle={
          fleetId
            ? `Live status for ${fleetName ?? fleetId}, scoped to the active key.`
            : 'Fleet and station control at a glance, scoped to the active key.'
        }
        actions={
          <label className="flex items-center gap-2 text-[12px] text-[var(--text-dim)] whitespace-nowrap">
            <RefreshCw size={13} className={pollSeconds ? 'animate-spin' : ''} />
            Auto-refresh
            <select
              className="input h-8 py-0 w-[84px]"
              value={pollSeconds}
              onChange={(e) => void updateSettings({ overviewPollSeconds: Number(e.target.value) })}
            >
              {POLL_CHOICES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </label>
        }
      />

      {placeholderBase && (
        <Card className="mb-4 border-[color-mix(in_srgb,var(--warn)_40%,transparent)]">
          <div className="flex items-center gap-2.5 text-[13px]">
            <AlertTriangle size={16} className="text-[var(--warn)]" />
            The API base URL is still the placeholder. Set your verified Orion Drift host in{' '}
            <button className="text-[var(--accent)] underline" onClick={() => navigate('/settings')}>Settings</button>{' '}
            for live data.
          </div>
        </Card>
      )}

      {/* Active key — identity + this fleet's access, one strip */}
      <div
        className="card p-4 mb-4 relative overflow-hidden"
        style={{
          backgroundImage:
            'radial-gradient(600px 220px at 85% -60px, color-mix(in srgb, var(--accent-2) 14%, transparent), transparent 70%)'
        }}
      >
        {active ? (
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <StatusDot status={active.health === 'valid' ? 'good' : active.health === 'unknown' ? 'idle' : 'bad'} />
                <span className="text-[15px] font-semibold tracking-tight truncate">{active.name}</span>
                <span className="text-[12px] text-[var(--text-dim)] mono">
                  {active.maskedHint} · validated {ago(active.lastValidatedAt)}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2 items-center">
                <ShieldCheck size={12} className="text-[var(--text-faint)]" />
                {currentScopes.includes('admin') ? (
                  <Badge tone="good">admin — full access to this fleet</Badge>
                ) : currentScopes.length ? (
                  currentScopes.filter((s) => s !== 'fleet:read').slice(0, 4).map((s) => (
                    <Badge key={s} tone="accent">{s}</Badge>
                  ))
                ) : (
                  <span className="text-[12px] text-[var(--text-faint)]">
                    {allGrants.length ? 'no elevated scopes probed for this fleet' : 'permissions not discovered yet'}
                  </span>
                )}
                {allGrants.length > 0 && (
                  <button
                    className="text-[11.5px] text-[var(--text-faint)] hover:text-[var(--text-dim)] inline-flex items-center gap-0.5"
                    onClick={() => setShowAllGrants((v) => !v)}
                  >
                    {showAllGrants ? 'hide' : 'all fleets'}
                    {showAllGrants ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  </button>
                )}
              </div>
            </div>
            <Button disabled={busy} onClick={() => void discover()} className="shrink-0">
              <Radar size={14} /> {busy ? 'Discovering…' : 'Discover permissions'}
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.14em] text-[var(--text-faint)] mb-1.5 flex items-center gap-1.5">
                <KeyRound size={12} /> Active key
              </div>
              <div className="text-[13px] text-[var(--text-dim)]">No key yet — add one to bring FleetView online.</div>
            </div>
            <Button variant="primary" onClick={() => navigate('/keys')}>Add a key</Button>
          </div>
        )}

        {showAllGrants && (
          <div className="mt-3 pt-3 border-t border-[var(--border-soft)] divide-y divide-[var(--border-soft)]">
            {grants.length > 0 ? (
              grants.map(([fleet, scopes]) => (
                <div key={fleet} className="py-2 flex items-center justify-between gap-4">
                  <div className="font-medium text-[13px] truncate">{fleetNames[fleet] ?? fleet}</div>
                  <div className="flex flex-wrap gap-1.5 justify-end shrink-0">
                    {scopes.includes('admin') ? (
                      <Badge tone="good">admin — full access</Badge>
                    ) : (
                      scopes.filter((s) => s !== 'admin').slice(0, 4).map((s) => (
                        <Badge key={s} tone="accent">{s}</Badge>
                      ))
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="py-2 text-[12.5px] text-[var(--text-faint)]">
                This key only has read access — no fleets with elevated permissions.
              </div>
            )}
          </div>
        )}
      </div>

      {fleetId ? (
        <FleetBoard key={fleetId} fleetId={fleetId} pollMs={pollSeconds * 1000} libCount={libCount} />
      ) : (
        <Card>
          <EmptyState
            icon={<Rocket size={22} />}
            title="No fleet selected"
            hint="Pick a fleet from the switcher in the header, or browse them in the Fleet Explorer."
            action={<Button variant="primary" onClick={() => navigate('/fleets')}>Go to Fleet Explorer</Button>}
          />
        </Card>
      )}
    </div>
  )
}

/** The live half of the page: stations, alerts, and recent activity for one fleet. */
function FleetBoard({ fleetId, pollMs, libCount }: { fleetId: string; pollMs: number; libCount: number }) {
  const navigate = useNavigate()
  const selectStation = useSelectionStore((s) => s.selectStation)
  const stationId = useSelectionStore((s) => s.stationId)

  const fleet = useEndpoint('fleet.get', { params: { fleetId }, auto: true, pollMs })
  const events = useEndpoint('events.fleet', { params: { fleetId }, auto: true, pollMs })
  // Bans and reports need scopes many keys lack. Never pre-flight deny — fire the request
  // and let these tiles read "—" if the server says no. They must not gate the page.
  const bans = useEndpoint('moderation.bans', {
    params: { fleetId, include_revoked: false, include_expired: false },
    auto: true,
    pollMs
  })
  const reports = useEndpoint('reports.list', { params: { fleetId, limit: 1000 }, auto: true, pollMs })

  const [showDisabled, setShowDisabled] = useState(false)

  const stations = asOverviewStations(fleet.response?.ok ? fleet.response.data : null)
  const liveCounts = stationPlayerCounts(events.response?.ok ? events.response.data : null)
  const summary = summarizeFleet(stations, liveCounts)
  const activity = recentActivity(events.response?.ok ? events.response.data : null)
  // Fleets keep a big disabled pool (Strike: 936 of 939). Listing it by default buries
  // the handful of stations that are actually running.
  const listed = showDisabled ? stations : stations.filter((s) => !s.disabled)

  const banTile = bans.response?.ok ? String(activeBanCount(bans.response.data)) : '—'
  const reportTile = reports.response?.ok ? String(reportCount(reports.response.data)) : '—'

  function refreshAll() {
    void fleet.run()
    void events.run()
    void bans.run()
    void reports.run()
  }

  const failed = fleet.response && !fleet.response.ok

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat
          icon={<Server size={14} />}
          label="Stations online"
          value={fleet.response?.ok ? `${summary.online}/${summary.active}` : '—'}
          hint={summary.disabled ? `+${summary.disabled} disabled` : undefined}
          tone={summary.active > 0 && summary.online === 0 ? 'bad' : 'default'}
        />
        <Stat icon={<Users size={14} />} label="Players in fleet" value={fleet.response?.ok ? String(summary.players) : '—'} />
        <Stat icon={<Gavel size={14} />} label="Active bans" value={banTile} />
        <Stat icon={<Flag size={14} />} label="Reports" value={reportTile} />
      </div>

      {summary.alerts.length > 0 && (
        <Card className="border-[color-mix(in_srgb,var(--warn)_40%,transparent)]">
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] text-[var(--warn)] mb-2.5">
            <AlertTriangle size={12} /> Needs attention
          </div>
          <div className="grid gap-1.5">
            {summary.alerts.slice(0, 8).map((a) => (
              <div key={a.stationId} className="text-[12.5px] flex items-center gap-2">
                <Badge tone="warn">quiet</Badge>
                <span className="font-medium truncate">{a.stationName}</span>
                <span className="text-[var(--text-faint)]">{a.detail}</span>
              </div>
            ))}
            {summary.alerts.length > 8 && (
              <div className="text-[12px] text-[var(--text-faint)]">
                + {summary.alerts.length - 8} more
              </div>
            )}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4 items-start">
        {/* Stations */}
        <Card className="p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-[var(--border-soft)] flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-[0.14em] text-[var(--text-faint)] flex items-center gap-1.5">
              <Server size={12} /> Stations
            </span>
            <div className="flex-1" />
            {summary.disabled > 0 && (
              <Button onClick={() => setShowDisabled((v) => !v)}>
                {showDisabled ? 'Hide' : 'Show'} {summary.disabled} disabled
              </Button>
            )}
            <Button onClick={refreshAll} disabled={fleet.loading}>
              <RefreshCw size={13} className={fleet.loading ? 'animate-spin' : ''} /> Refresh
            </Button>
          </div>
          {failed ? (
            <div className="px-5 py-4 text-[12.5px] text-[var(--text-dim)] flex items-center gap-2 flex-wrap">
              <AlertTriangle size={14} className="text-[var(--warn)]" />
              Couldn&apos;t load stations
              {fleet.response?.error?.message ? ` — ${fleet.response.error.message}` : ` (HTTP ${fleet.response?.status})`}.
              <button className="text-[var(--accent)] underline" onClick={() => void fleet.run()}>Retry</button>
            </div>
          ) : fleet.loading && !fleet.response ? (
            <div className="px-5 py-6"><Spinner label="Loading stations…" /></div>
          ) : listed.length === 0 ? (
            <div className="px-5 py-4 text-[12.5px] text-[var(--text-faint)]">
              {stations.length === 0
                ? 'This fleet has no stations.'
                : `No enabled stations — all ${summary.disabled} are disabled.`}
            </div>
          ) : (
            <div className="divide-y divide-[var(--border-soft)] max-h-[560px] overflow-y-auto">
              {listed.map((s) => {
                const count = liveCounts.get(s.id) ?? s.playerCount
                return (
                  <button
                    key={s.id}
                    onClick={() => {
                      selectStation(s.id, s.name)
                      navigate('/stations')
                    }}
                    className={`w-full px-5 py-3 flex items-center gap-3 text-left transition-colors hover:bg-[var(--bg-elev-2)] group ${
                      s.id === stationId ? 'bg-[var(--bg-elev-2)]/60' : ''
                    }`}
                  >
                    <StatusDot status={s.disabled ? 'bad' : s.online ? 'good' : 'warn'} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13.5px] font-medium truncate">{s.name}</span>
                      <span className="block text-[11.5px] text-[var(--text-faint)] truncate">
                        {s.lastEventAt ? `last event ${ago(s.lastEventAt)}` : 'no events reported'}
                      </span>
                    </span>
                    <span className="flex flex-wrap gap-1.5 justify-end shrink-0">
                      {s.disabled && <Badge tone="bad">disabled</Badge>}
                      {s.region && <Badge>{regionLabel(s.region)}</Badge>}
                      {s.version && <Badge><Cpu size={10} /> {s.version}</Badge>}
                      {count != null && <Badge tone="accent"><Users size={10} /> {count}</Badge>}
                    </span>
                    <ChevronRight size={14} className="text-[var(--text-faint)] shrink-0 transition-transform group-hover:translate-x-0.5" />
                  </button>
                )
              })}
            </div>
          )}
        </Card>

        <div className="grid gap-4">
          {/* Recent activity */}
          <Card className="p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--border-soft)] text-[11px] uppercase tracking-[0.14em] text-[var(--text-faint)] flex items-center gap-1.5">
              <Activity size={12} /> Recent activity
            </div>
            {activity.length > 0 ? (
              <div className="divide-y divide-[var(--border-soft)]">
                {activity.map((e) => (
                  <div key={e.id} className="px-4 py-2.5 flex items-center gap-2">
                    <Badge tone="accent">{e.type}</Badge>
                    <div className="flex-1" />
                    <span className="text-[11px] text-[var(--text-faint)] shrink-0">{ago(e.timestamp)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-4 py-3.5 text-[12px] text-[var(--text-faint)]">
                {events.response?.ok ? 'Nothing but station heartbeats.' : 'No event feed for this fleet.'}
              </div>
            )}
          </Card>

          {/* Go places */}
          <Card className="p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--border-soft)] text-[11px] uppercase tracking-[0.14em] text-[var(--text-faint)]">
              Jump to
            </div>
            <div className="divide-y divide-[var(--border-soft)]">
              <NavRow icon={<Users size={15} />} label="Player Manager" detail="roles, bans, lookup" onClick={() => navigate('/players')} />
              <NavRow icon={<Gavel size={15} />} label="Moderation" detail={`${banTile} active bans`} onClick={() => navigate('/moderation')} />
              <NavRow icon={<Rocket size={15} />} label="Fleet Explorer" detail="browse your fleets" onClick={() => navigate('/fleets')} />
              <NavRow icon={<KeyRound size={15} />} label="LE Library" detail={`${libCount} saved config${libCount === 1 ? '' : 's'}`} onClick={() => navigate('/le-library')} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

function Stat({
  icon,
  label,
  value,
  hint,
  tone = 'default'
}: {
  icon: React.ReactNode
  label: string
  value: string
  hint?: string
  tone?: 'default' | 'bad'
}) {
  return (
    <Card className="py-3">
      <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--text-faint)] flex items-center gap-1.5">
        {icon} {label}
      </div>
      <div className="flex items-baseline gap-2 mt-1">
        <span
          className="text-[22px] font-semibold tracking-tight"
          style={tone === 'bad' ? { color: 'var(--bad)' } : undefined}
        >
          {value}
        </span>
        {hint && <span className="text-[11.5px] text-[var(--text-faint)]">{hint}</span>}
      </div>
    </Card>
  )
}

function NavRow({
  icon,
  label,
  detail,
  onClick
}: {
  icon: React.ReactNode
  label: string
  detail: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="w-full px-4 py-3 flex items-center gap-3 text-left transition-colors hover:bg-[var(--bg-elev-2)] group"
    >
      <span className="text-[var(--accent)] shrink-0">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium">{label}</span>
        <span className="block text-[11.5px] text-[var(--text-faint)] truncate">{detail}</span>
      </span>
      <ChevronRight
        size={14}
        className="text-[var(--text-faint)] shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--text-dim)]"
      />
    </button>
  )
}
