import { useState } from 'react'
import { Lock, Trash2, Clock } from 'lucide-react'
import { api } from '../../lib/api'
import { useEndpoint } from '../../services/useEndpoint'
import { PageHeader, Card, Button, Badge, Field, JsonBlock, EmptyState } from '../components/ui'
import { RequestResult } from '../components/RequestResult'
import { PermissionGate } from '../components/PermissionGate'
import { FleetScoped } from '../components/FleetScoped'
import { ts } from '../../lib/format'
import { asBans } from '../../lib/bans'
import { resolveUserId } from '../../lib/fleetUsers'
import { useAppStore } from '../../state/useAppStore'

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
    const durationHours = parseInt(banHours, 10) || 24
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <PermissionGate scope="user_ban:write">
          <Card>
            <div className="font-medium mb-4 flex items-center gap-2">
              <Lock size={16} /> Ban Player
            </div>
            <div className="space-y-3">
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
                  className="input text-[12px]"
                  rows={2}
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
                  {banResult.error && <JsonBlock value={banResult.error} className="max-h-32" />}
                </>
              )}
            </div>
          </Card>
        </PermissionGate>

        <PermissionGate scope="user_ban:revoke">
          <Card>
            <div className="font-medium mb-4 flex items-center gap-2">
              <Trash2 size={16} /> Unban Player
            </div>
            <div className="space-y-3">
              <Field label="Player name or user ID">
                <input
                  className="input text-[12px]"
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
                  {unbanResult.error && <JsonBlock value={unbanResult.error} className="max-h-32" />}
                </>
              )}
            </div>
          </Card>
        </PermissionGate>

        <PermissionGate scope="user_data:read">
          <Card>
            <div className="font-medium mb-4 flex items-center gap-2">
              <Clock size={16} /> Recent Bans
            </div>
            <RequestResult response={bansResponse} loading={bansLoading} onRetry={() => void runBans()}>
              {(raw) => {
                const bans = asBans(raw)
                return bans.length > 0 ? (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {bans.slice(0, 10).map((ban) => (
                      <div key={ban.id} className="text-[11px] p-2 bg-[var(--bg-deep)] rounded border border-[var(--border-soft)]">
                        <div className="flex items-center justify-between mb-1">
                          <Badge tone="bad">{ban.username ?? ban.userId}</Badge>
                          {showIds && ban.username && (
                            <span className="mono text-[10px] text-[var(--text-faint)]">{ban.userId}</span>
                          )}
                          {ban.expiresAt && (
                            <span className="text-[var(--text-dim)] text-[10px]">
                              {ts(ban.expiresAt)}
                            </span>
                          )}
                        </div>
                        <p className="text-[var(--text-dim)] truncate">{ban.reason}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState title="No bans" />
                )
              }}
            </RequestResult>
          </Card>
        </PermissionGate>
      </div>
    </div>
  )
}
