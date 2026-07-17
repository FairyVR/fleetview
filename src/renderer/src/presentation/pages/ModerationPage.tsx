import { useState } from 'react'
import { Lock, Trash2, Zap } from 'lucide-react'
import { api } from '../../lib/api'
import { PageHeader, Card, Button, Badge, Field, JsonBlock } from '../components/ui'
import { PermissionGate } from '../components/PermissionGate'
import { useSelectionStore } from '../../state/useSelectionStore'

export default function ModerationPage() {
  const stationId = useSelectionStore((s) => s.stationId)
  const [banPlayerId, setBanPlayerId] = useState('')
  const [banReason, setBanReason] = useState('')
  const [banHours, setBanHours] = useState('24')
  const [banResult, setBanResult] = useState<{ ok: boolean; error?: unknown } | null>(null)

  const [unbanId, setUnbanId] = useState('')
  const [unbanResult, setUnbanResult] = useState<{ ok: boolean; error?: unknown } | null>(null)

  const [kickPlayerId, setKickPlayerId] = useState('')
  const [kickResult, setKickResult] = useState<{ ok: boolean; error?: unknown } | null>(null)

  async function handleBan() {
    if (!banPlayerId.trim() || !banReason.trim()) return
    const durationHours = parseInt(banHours, 10) || 24
    const res = await api.request({
      endpointId: 'moderation.ban',
      body: {
        playerId: banPlayerId,
        reason: banReason,
        durationHours
      }
    })
    setBanResult({ ok: res.ok, error: res.error })
    if (res.ok) {
      setBanPlayerId('')
      setBanReason('')
      setBanHours('24')
    }
    setTimeout(() => setBanResult(null), 3000)
  }

  async function handleUnban() {
    if (!unbanId.trim()) return
    const res = await api.request({
      endpointId: 'moderation.unban',
      params: { banId: unbanId }
    })
    setUnbanResult({ ok: res.ok, error: res.error })
    if (res.ok) {
      setUnbanId('')
    }
    setTimeout(() => setUnbanResult(null), 3000)
  }

  async function handleKick() {
    if (!kickPlayerId.trim() || !stationId) return
    const res = await api.request({
      endpointId: 'moderation.kick',
      params: { stationId },
      body: { playerId: kickPlayerId }
    })
    setKickResult({ ok: res.ok, error: res.error })
    if (res.ok) {
      setKickPlayerId('')
    }
    setTimeout(() => setKickResult(null), 3000)
  }

  return (
    <div>
      <PageHeader
        title="Moderation"
        subtitle="Issue bans, unban players, and kick from servers."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <PermissionGate scope="moderation">
          <Card>
            <div className="font-medium mb-4 flex items-center gap-2">
              <Lock size={16} /> Ban Player
            </div>
            <div className="space-y-3">
              <Field label="Player ID">
                <input
                  className="input"
                  placeholder="Player ID…"
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

        <PermissionGate scope="moderation">
          <Card>
            <div className="font-medium mb-4 flex items-center gap-2">
              <Trash2 size={16} /> Unban Player
            </div>
            <div className="space-y-3">
              <Field label="Ban Record ID">
                <input
                  className="input mono text-[12px]"
                  placeholder="Ban ID…"
                  value={unbanId}
                  onChange={(e) => setUnbanId(e.target.value)}
                />
              </Field>
              <Button
                variant="primary"
                onClick={() => void handleUnban()}
                disabled={!unbanId.trim()}
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

        <PermissionGate scope="moderation">
          <Card>
            <div className="font-medium mb-4 flex items-center gap-2">
              <Zap size={16} /> Kick Player
            </div>
            {!stationId ? (
              <Badge tone="warn">Select a station first</Badge>
            ) : (
              <div className="space-y-3">
                <Field label="Player ID">
                  <input
                    className="input"
                    placeholder="Player ID…"
                    value={kickPlayerId}
                    onChange={(e) => setKickPlayerId(e.target.value)}
                  />
                </Field>
                <Button
                  variant="danger"
                  onClick={() => void handleKick()}
                  disabled={!kickPlayerId.trim()}
                  className="w-full justify-center"
                >
                  <Zap size={13} /> Kick
                </Button>
                {kickResult && (
                  <>
                    <Badge tone={kickResult.ok ? 'good' : 'bad'}>
                      {kickResult.ok ? 'Player kicked' : 'Kick failed'}
                    </Badge>
                    {kickResult.error && <JsonBlock value={kickResult.error} className="max-h-32" />}
                  </>
                )}
              </div>
            )}
          </Card>
        </PermissionGate>
      </div>
    </div>
  )
}
