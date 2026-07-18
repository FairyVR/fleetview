import { useState } from 'react'
import { Search, Lock, Shield } from 'lucide-react'
import { api } from '../../lib/api'
import { useEndpoint } from '../../services/useEndpoint'
import { PageHeader, Card, Button, Badge, Field, EmptyState, JsonBlock } from '../components/ui'
import { RequestResult } from '../components/RequestResult'
import { PermissionGate } from '../components/PermissionGate'
import { FleetScoped } from '../components/FleetScoped'
import { Modal } from '../components/Modal'

interface Player {
  id: string
  displayName: string
  roles?: string[]
}

interface Ban {
  id: string
  userId: string
  reason: string
  bannedAt: number
  expiresAt?: number
}

function asPlayers(data: unknown): Player[] {
  const arr = Array.isArray(data) ? data : (data as { items?: unknown[] })?.items ?? []
  return (arr as Record<string, unknown>[]).map((p) => ({
    id: String(p.user_id ?? p.id ?? ''),
    displayName: String(p.display_name ?? p.displayName ?? p.name ?? 'Unknown'),
    roles: Array.isArray(p.roles) ? (p.roles as string[]) : undefined
  }))
}

function asBans(data: unknown): Ban[] {
  const arr = Array.isArray(data) ? data : (data as { bans?: unknown[] })?.bans ?? (data as { items?: unknown[] })?.items ?? []
  return (arr as Record<string, unknown>[]).map((b) => ({
    id: String(b.ban_id ?? b.id ?? ''),
    userId: String(b.user_id ?? b.userId ?? ''),
    reason: String(b.reason ?? ''),
    bannedAt: Number(b.banned_at ?? b.bannedAt ?? 0),
    expiresAt: (b.expires_at ?? b.expiresAt) as number | undefined
  }))
}

export default function PlayerPage() {
  return (
    <div>
      <PageHeader
        title="Player Manager"
        subtitle="Search for players and manage their roles and bans."
      />
      <FleetScoped>{(fleetId) => <PlayerSearcher fleetId={fleetId} />}</FleetScoped>
    </div>
  )
}

function PlayerSearcher({ fleetId }: { fleetId: string }) {
  const [query, setQuery] = useState('')
  const { response, loading, run } = useEndpoint<unknown>('player.listByFleet', {
    params: query ? { fleetId, search_string: query } : { fleetId },
    auto: false
  })
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null)
  const [banReason, setBanReason] = useState('')
  const [banHours, setBanHours] = useState('24')
  const [banHistory, setBanHistory] = useState<Ban[]>([])
  const [loadingBans, setLoadingBans] = useState(false)

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (query.trim()) void run()
  }

  async function openDetail(player: Player) {
    setSelectedPlayer(player)
    setDetailOpen(true)
    setLoadingBans(true)
    try {
      const res = await api.request({
        endpointId: 'player.bans',
        params: { fleetId, userId: player.id }
      })
      setBanHistory(asBans(res.data))
    } finally {
      setLoadingBans(false)
    }
  }

  async function handleBan() {
    if (!selectedPlayer || !banReason.trim()) return
    const durationHours = parseInt(banHours, 10) || 24
    const res = await api.request({
      endpointId: 'moderation.ban',
      params: { fleetId, userId: selectedPlayer.id },
      body: {
        reason: banReason,
        duration_hours: durationHours
      }
    })
    if (res.ok) {
      setBanReason('')
      setBanHours('24')
      setDetailOpen(false)
    }
  }

  return (
    <div>
      <form onSubmit={handleSearch} className="mb-4">
        <Field label="Search players">
          <div className="flex gap-2">
            <input
              className="input flex-1"
              placeholder="Player name or ID…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <Button variant="primary" type="submit" disabled={loading}>
              <Search size={14} /> Search
            </Button>
          </div>
        </Field>
      </form>

      <RequestResult
        response={response}
        loading={loading}
        onRetry={() => void run()}
        empty={<EmptyState title="No players found" hint="Use the search bar to find players in this fleet." />}
      >
        {(raw) => {
          const found = asPlayers(raw)
          return (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {found.map((player) => (
                <button
                  key={player.id}
                  onClick={() => void openDetail(player)}
                  className="card p-4 text-left hover:border-[var(--accent-2)] transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="font-medium">{player.displayName}</div>
                      <div className="text-[11px] text-[var(--text-faint)] mono">{player.id}</div>
                    </div>
                  </div>
                  {player.roles && player.roles.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {player.roles.map((role) => (
                        <Badge key={role} tone="accent">
                          {role}
                        </Badge>
                      ))}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )
        }}
      </RequestResult>

      <Modal
        open={detailOpen}
        title={selectedPlayer?.displayName ?? 'Player'}
        onClose={() => setDetailOpen(false)}
        wide
        footer={
          <Button variant="ghost" onClick={() => setDetailOpen(false)}>
            Close
          </Button>
        }
      >
        {selectedPlayer && (
          <div className="space-y-4">
            <JsonBlock value={selectedPlayer} />

            <div className="space-y-3">
              <h3 className="font-medium flex items-center gap-2">
                <Shield size={14} /> Actions
              </h3>

              <PermissionGate scope="user_ban:write">
                <Card>
                  <div className="space-y-3">
                    <Field label="Ban reason">
                      <textarea
                        className="input text-[12px]"
                        rows={2}
                        value={banReason}
                        onChange={(e) => setBanReason(e.target.value)}
                        placeholder="Reason for ban…"
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
                    <Button variant="danger" onClick={() => void handleBan()}>
                      <Lock size={13} /> Ban
                    </Button>
                  </div>
                </Card>
              </PermissionGate>
            </div>

            <div className="space-y-3">
              <h3 className="font-medium">Ban history</h3>
              {loadingBans ? (
                <p className="text-[12px] text-[var(--text-dim)]">Loading…</p>
              ) : banHistory.length > 0 ? (
                <div className="space-y-2">
                  {banHistory.map((ban) => (
                    <Card key={ban.id} className="p-3">
                      <div className="text-[12px] space-y-1">
                        <div className="flex items-center justify-between">
                          <Badge tone="bad">{ban.id}</Badge>
                          {ban.expiresAt && (
                            <span className="text-[var(--text-dim)]">
                              expires {new Date(ban.expiresAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        <p className="text-[var(--text-dim)]">{ban.reason}</p>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <EmptyState title="No bans" />
              )}
            </div>

            <div className="space-y-3">
              <h3 className="font-medium">Reports</h3>
              <EmptyState title="No records" />
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
