import { useEffect, useState, type ReactNode } from 'react'
import { Lock, Trash2, Clock, Maximize2, X } from 'lucide-react'
import { api } from '../../lib/api'
import { useEndpoint } from '../../services/useEndpoint'
import { PageHeader, Button, Badge, Field, JsonBlock, EmptyState } from '../components/ui'
import { RequestResult } from '../components/RequestResult'
import { PermissionGate } from '../components/PermissionGate'
import { FleetScoped } from '../components/FleetScoped'
import { ts } from '../../lib/format'
import { asBans } from '../../lib/bans'
import { resolveUserId } from '../../lib/fleetUsers'
import { useAppStore } from '../../state/useAppStore'

/**
 * Panel that can be popped out into a near-fullscreen overlay for better viewing.
 * Escape or the backdrop closes it.
 */
function ExpandablePanel({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (!expanded) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setExpanded(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [expanded])

  const panel = (
    <div className={expanded ? 'card p-6 w-full max-w-3xl max-h-[88vh] flex flex-col shadow-2xl' : 'card p-5'}>
      <div className="font-medium mb-4 flex items-center gap-2 text-[14.5px]">
        {icon} {title}
        <div className="flex-1" />
        <Button
          variant="ghost"
          title={expanded ? 'Close' : 'Enlarge'}
          onClick={() => setExpanded(!expanded)}
          className="!p-1.5"
        >
          {expanded ? <X size={16} /> : <Maximize2 size={14} className="text-[var(--text-faint)]" />}
        </Button>
      </div>
      <div className={expanded ? 'overflow-y-auto flex-1 min-h-0' : undefined}>{children}</div>
    </div>
  )

  if (!expanded) return panel
  return (
    <>
      {/* keep the grid cell occupied while the overlay is open */}
      <div className="card p-5 opacity-40 min-h-[80px]" />
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-8 bg-black/60 backdrop-blur-sm"
        onClick={(e) => e.target === e.currentTarget && setExpanded(false)}
      >
        {panel}
      </div>
    </>
  )
}

export default function ModerationPage() {
  return (
    <div>
      <PageHeader
        title="Moderation"
        subtitle="Issue and manage player bans."
      />
      <FleetScoped>{(fleetId) => <ModerationPanel fleetId={fleetId} />}</FleetScoped>
    </div>
  )
}

function ModerationPanel({ fleetId }: { fleetId: string }) {
  const showIds = useAppStore((s) => s.settings?.showIds ?? false)
  const [banPlayerId, setBanPlayerId] = useState('')
  const [banReason, setBanReason] = useState('')
  const [banHours, setBanHours] = useState('24')
  const [banResult, setBanResult] = useState<{ ok: boolean; error?: unknown } | null>(null)

  const [unbanUserId, setUnbanUserId] = useState('')
  const [unbanResult, setUnbanResult] = useState<{ ok: boolean; error?: unknown } | null>(null)

  const { response: bansResponse, loading: bansLoading, run: runBans } = useEndpoint<unknown>('moderation.bans', {
    params: { fleetId, include_revoked: true, include_expired: true },
    auto: true
  })

  async function handleBan() {
    if (!banPlayerId.trim() || !banReason.trim()) return
    const durationHours = parseInt(banHours, 10)
    if (!Number.isFinite(durationHours) || durationHours < 1) {
      setBanResult({ ok: false, error: 'Duration must be a whole number of hours ≥ 1.' })
      setTimeout(() => setBanResult(null), 3000)
      return
    }
    const resolved = await resolveUserId(fleetId, banPlayerId)
    if ('error' in resolved) {
      setBanResult({ ok: false, error: resolved.error })
      setTimeout(() => setBanResult(null), 3000)
      return
    }
    const res = await api.request({
      endpointId: 'moderation.ban',
      params: { fleetId, userId: resolved.userId },
      body: {
        reason: banReason,
        duration_hours: durationHours
      }
    })
    setBanResult({ ok: res.ok, error: res.error })
    if (res.ok) {
      setBanPlayerId('')
      setBanReason('')
      setBanHours('24')
      void runBans()
    }
    setTimeout(() => setBanResult(null), 3000)
  }

  async function handleUnban() {
    if (!unbanUserId.trim()) return
    const resolved = await resolveUserId(fleetId, unbanUserId)
    if ('error' in resolved) {
      setUnbanResult({ ok: false, error: resolved.error })
      setTimeout(() => setUnbanResult(null), 3000)
      return
    }
    const res = await api.request({
      endpointId: 'moderation.unban',
      params: { fleetId, userId: resolved.userId }
    })
    setUnbanResult({ ok: res.ok, error: res.error })
    if (res.ok) {
      setUnbanUserId('')
      void runBans()
    }
    setTimeout(() => setUnbanResult(null), 3000)
  }

  return (
    <div>
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(360px,440px)_1fr] gap-5 items-start">
        <div className="grid gap-5">
        <PermissionGate scope="user_ban:write">
          <ExpandablePanel icon={<Lock size={16} />} title="Ban Player">
            <div className="space-y-4">
              <Field label="Player name or user ID">
                <input
                  className="input"
                  placeholder="e.g. Fairy- or 4086705431367530"
                  value={banPlayerId}
                  onChange={(e) => setBanPlayerId(e.target.value)}
                />
              </Field>
              <Field label="Reason">
                <textarea
                  className="input"
                  rows={3}
                  placeholder="Reason…"
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                />
              </Field>
              <Field label="Duration (hours)">
                <input
                  className="input"
                  type="number"
                  min="1"
                  value={banHours}
                  onChange={(e) => setBanHours(e.target.value)}
                />
              </Field>
              <Button
                variant="danger"
                onClick={() => void handleBan()}
                disabled={!banPlayerId.trim() || !banReason.trim()}
                className="w-full justify-center"
              >
                <Lock size={13} /> Ban
              </Button>
              {banResult && (
                <>
                  <Badge tone={banResult.ok ? 'good' : 'bad'}>
                    {banResult.ok ? 'Ban issued' : 'Ban failed'}
                  </Badge>
                  {banResult.error && <JsonBlock value={banResult.error} className="max-h-40" />}
                </>
              )}
            </div>
          </ExpandablePanel>
        </PermissionGate>

        <PermissionGate scope="user_ban:revoke">
          <ExpandablePanel icon={<Trash2 size={16} />} title="Unban Player">
            <div className="space-y-4">
              <Field label="Player name or user ID">
                <input
                  className="input"
                  placeholder="e.g. Fairy- or 4086705431367530"
                  value={unbanUserId}
                  onChange={(e) => setUnbanUserId(e.target.value)}
                />
              </Field>
              <Button
                variant="primary"
                onClick={() => void handleUnban()}
                disabled={!unbanUserId.trim()}
                className="w-full justify-center"
              >
                <Trash2 size={13} /> Unban
              </Button>
              {unbanResult && (
                <>
                  <Badge tone={unbanResult.ok ? 'good' : 'bad'}>
                    {unbanResult.ok ? 'Ban removed' : 'Unban failed'}
                  </Badge>
                  {unbanResult.error && <JsonBlock value={unbanResult.error} className="max-h-40" />}
                </>
              )}
            </div>
          </ExpandablePanel>
        </PermissionGate>
        </div>

        <PermissionGate scope="user_data:read">
          <ExpandablePanel icon={<Clock size={16} />} title="Recent Bans">
            <RequestResult response={bansResponse} loading={bansLoading} onRetry={() => void runBans()}>
              {(raw) => {
                const bans = asBans(raw)
                return bans.length > 0 ? (
                  <div className="space-y-2.5 max-h-[68vh] overflow-y-auto pr-1">
                    {bans.slice(0, 50).map((ban) => {
                      const expired = ban.expiresAt != null && ban.expiresAt < Date.now()
                      const inactive = ban.revoked || expired
                      return (
                      <div
                        key={ban.id}
                        className={`text-[12.5px] p-3 bg-[var(--bg)] rounded-lg border border-[var(--border-soft)] ${inactive ? 'opacity-55' : ''}`}
                      >
                        <div className="flex items-center justify-between gap-3 mb-1.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <Badge tone={inactive ? 'neutral' : 'bad'}>{ban.username ?? ban.userId}</Badge>
                            {ban.revoked ? (
                              <Badge tone="good">revoked</Badge>
                            ) : expired ? (
                              <Badge tone="neutral">expired</Badge>
                            ) : (
                              <Badge tone="warn">active</Badge>
                            )}
                          </div>
                          {showIds && ban.username && (
                            <span className="mono text-[11px] text-[var(--text-faint)]">{ban.userId}</span>
                          )}
                          {ban.expiresAt && (
                            <span className="text-[var(--text-dim)] text-[11px] shrink-0">
                              {expired ? 'expired' : 'expires'} {ts(ban.expiresAt)}
                            </span>
                          )}
                        </div>
                        <p className="text-[var(--text-dim)]">{ban.reason}</p>
                      </div>
                      )
                    })}
                  </div>
                ) : (
                  <EmptyState title="No bans" />
                )
              }}
            </RequestResult>
          </ExpandablePanel>
        </PermissionGate>
      </div>
    </div>
  )
}
