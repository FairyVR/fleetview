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
  Library
} from 'lucide-react'
import { useAppStore } from '../../state/useAppStore'
import { api } from '../../lib/api'
import { ago } from '../../lib/format'
import { PageHeader, Card, Button, Badge, StatusDot } from '../components/ui'

export default function DashboardPage() {
  const { keys, activeKeyId, permissions, settings, discoverActive } = useAppStore()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const active = keys.find((k) => k.id === activeKeyId)
  const placeholderBase = settings?.baseUrl.includes('example')

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

  return (
    <div className="max-w-5xl">
      <PageHeader
        title="Overview"
        subtitle="Fleet and station control at a glance, scoped to the active key."
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

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4 items-start">
        <div className="grid gap-4">
          {/* Active key — identity, not numbers */}
          <div
            className="card p-5 relative overflow-hidden"
            style={{
              backgroundImage:
                'radial-gradient(600px 220px at 85% -60px, color-mix(in srgb, var(--accent-2) 14%, transparent), transparent 70%)'
            }}
          >
            {active ? (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-[11px] uppercase tracking-[0.14em] text-[var(--text-faint)] mb-2 flex items-center gap-1.5">
                      <KeyRound size={12} /> Active key
                    </div>
                    <div className="flex items-center gap-2.5">
                      <StatusDot status={active.health === 'valid' ? 'good' : active.health === 'unknown' ? 'idle' : 'bad'} />
                      <span className="text-lg font-semibold tracking-tight truncate">{active.name}</span>
                    </div>
                    <div className="text-[12px] text-[var(--text-dim)] mono mt-1.5">
                      {active.maskedHint} · validated {ago(active.lastValidatedAt)}
                    </div>
                  </div>
                  <Button disabled={busy} onClick={() => void discover()} className="shrink-0">
                    <Radar size={14} /> {busy ? 'Discovering…' : 'Discover permissions'}
                  </Button>
                </div>
              </>
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
          </div>

          {/* Access — per-fleet grants as a tidy list */}
          {active && (
            <Card className="p-0 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-[var(--border-soft)] flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] text-[var(--text-faint)]">
                <ShieldCheck size={12} /> Fleet access
              </div>
              {grants.length > 0 ? (
                <div className="divide-y divide-[var(--border-soft)]">
                  {grants.map(([fleet, scopes]) => {
                    const admin = scopes.includes('admin')
                    const rest = scopes.filter((s) => s !== 'admin')
                    return (
                      <div key={fleet} className="px-5 py-3 flex items-center justify-between gap-4">
                        <div className="font-medium text-[13.5px] truncate">{fleetNames[fleet] ?? fleet}</div>
                        <div className="flex flex-wrap gap-1.5 justify-end shrink-0">
                          {admin ? (
                            <Badge tone="good">admin — full access</Badge>
                          ) : (
                            <>
                              {rest.slice(0, 3).map((s) => (
                                <Badge key={s} tone="accent">{s}</Badge>
                              ))}
                              {rest.length > 3 && <Badge>+{rest.length - 3} more</Badge>}
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="px-5 py-4 text-[12.5px] text-[var(--text-faint)]">
                  {allGrants.length > 0
                    ? 'This key only has read access — no fleets with elevated permissions.'
                    : 'Permissions not discovered yet — run discovery to see per-fleet grants. Until then, actions are attempted and the server decides.'}
                </div>
              )}
            </Card>
          )}
        </div>

        {/* Go places — navigation first, counts as whispers */}
        <Card className="p-0 overflow-hidden">
          <div className="px-4 py-3.5 border-b border-[var(--border-soft)] text-[11px] uppercase tracking-[0.14em] text-[var(--text-faint)]">
            Jump to
          </div>
          <div className="divide-y divide-[var(--border-soft)]">
            <NavRow
              icon={<Rocket size={15} />}
              label="Fleet Explorer"
              detail={allGrants.length ? `${allGrants.length} fleet${allGrants.length === 1 ? '' : 's'} granted` : 'browse your fleets'}
              onClick={() => navigate('/fleets')}
            />
            <NavRow
              icon={<Server size={15} />}
              label="Station Manager"
              detail="boards, gamemodes, events"
              onClick={() => navigate('/stations')}
            />
            <NavRow
              icon={<KeyRound size={15} />}
              label="API Keys"
              detail={`${keys.length} stored`}
              onClick={() => navigate('/keys')}
            />
            <NavRow
              icon={<Library size={15} />}
              label="LE Library"
              detail={`${libCount} saved config${libCount === 1 ? '' : 's'}`}
              onClick={() => navigate('/le-library')}
            />
          </div>
        </Card>
      </div>
    </div>
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
