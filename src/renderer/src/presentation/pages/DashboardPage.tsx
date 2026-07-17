import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { KeyRound, ShieldCheck, Rocket, Server, Radar, AlertTriangle } from 'lucide-react'
import { useAppStore } from '../../state/useAppStore'
import { api } from '../../lib/api'
import { ago } from '../../lib/format'
import { PageHeader, Card, Button, Badge, StatusDot } from '../components/ui'

const SCOPES = [
  ['read', 'Read'],
  ['write', 'Write'],
  ['moderation', 'Moderation'],
  ['playerManagement', 'Players'],
  ['roleManagement', 'Roles'],
  ['customization', 'Customization'],
  ['events', 'Events']
] as const

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

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Fleet and station control at a glance. Everything is scoped to the active API key's discovered permissions."
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Active key */}
        <Card className="lg:col-span-2 grid gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <KeyRound size={16} className="text-[var(--accent)]" />
              <span className="font-semibold">Active key</span>
            </div>
            {active ? (
              <Button disabled={busy} onClick={() => void discover()}>
                <Radar size={14} /> {busy ? 'Discovering…' : 'Discover permissions'}
              </Button>
            ) : (
              <Button variant="primary" onClick={() => navigate('/keys')}>Add a key</Button>
            )}
          </div>

          {active ? (
            <>
              <div className="flex items-center gap-3">
                <StatusDot status={active.health === 'valid' ? 'good' : active.health === 'unknown' ? 'idle' : 'bad'} />
                <div>
                  <div className="font-medium">{active.name}</div>
                  <div className="text-[12px] text-[var(--text-dim)] mono">{active.maskedHint} · validated {ago(active.lastValidatedAt)}</div>
                </div>
              </div>
              <div>
                <div className="label flex items-center gap-1.5"><ShieldCheck size={12} /> Permissions</div>
                <div className="flex flex-wrap gap-1.5">
                  {SCOPES.map(([flag, label]) => (
                    <Badge key={flag} tone={permissions[flag] ? 'good' : 'neutral'}>
                      {permissions[flag] ? '✓' : '×'} {label}
                    </Badge>
                  ))}
                </div>
                {permissions.discoveredAt === 0 && (
                  <div className="text-[12px] text-[var(--text-faint)] mt-2">
                    Permissions not discovered yet — run discovery to gate the UI precisely.
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-[13px] text-[var(--text-dim)]">No active key. Add one to begin.</div>
          )}
        </Card>

        {/* Quick stats */}
        <div className="grid gap-4">
          <Stat icon={<Rocket size={16} />} label="Fleets in scope" value={permissions.fleets.length || '—'} onClick={() => navigate('/fleets')} />
          <Stat icon={<Server size={16} />} label="Stations in scope" value={permissions.stations.length || '—'} onClick={() => navigate('/stations')} />
          <Stat icon={<KeyRound size={16} />} label="Stored keys" value={keys.length} onClick={() => navigate('/keys')} />
          <Stat icon={<ShieldCheck size={16} />} label="LE configs saved" value={libCount} onClick={() => navigate('/le-library')} />
        </div>
      </div>
    </div>
  )
}

function Stat({
  icon,
  label,
  value,
  onClick
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  onClick: () => void
}) {
  return (
    <button onClick={onClick} className="card p-4 text-left hover:border-[var(--border)] transition-colors">
      <div className="flex items-center gap-2 text-[var(--text-dim)] text-[12px]">
        {icon} {label}
      </div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </button>
  )
}
