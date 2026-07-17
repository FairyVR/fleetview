import { useState } from 'react'
import { Search, Lock, Zap, Shield } from 'lucide-react'
import type { Player } from '@shared/models'
import { api } from '../../lib/api'
import { useEndpoint } from '../../services/useEndpoint'
import { PageHeader, Card, Button, Badge, Field, EmptyState, JsonBlock } from '../components/ui'
import { RequestResult } from '../components/RequestResult'
import { PermissionGate } from '../components/PermissionGate'
import { Modal } from '../components/Modal'

function asPlayers(data: unknown): Player[] {
  const arr = Array.isArray(data) ? data : (data as { players?: unknown[] })?.players ?? []
  return (arr as Record<string, unknown>[]).map((p) => ({
    id: String(p.id ?? p.playerId ?? ''),
    displayName: String(p.displayName ?? p.name ?? 'Unknown'),
    platformId: p.platformId as string | undefined,
    roles: Array.isArray(p.roles) ? (p.roles as string[]) : undefined,
    banned: Boolean(p.banned),
    raw: p
  }))
}

export default function PlayerPage() {
  const [query, setQuery] = useState('')
  const { response, loading, run } = useEndpoint<unknown>('player.search', {
    params: query ? { q: query } : undefined,
    auto: false
  })
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null)
  const [banReason, setBanReason] = useState('')
  const [banHours, setBanHours] = useState('24')

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (query.trim()) void run()
  }

  function openDetail(player: Player) {
    setSelectedPlayer(player)
    setDetailOpen(true)
  }

  async function handleBan() {
    if (!selectedPlayer || !banReason.trim()) return
    const durationHours = parseInt(banHours, 10) || 24
    const res = await api.request({
      endpointId: 'moderation.ban',
      body: {
        playerId: selectedPlayer.id,
        reason: banReason,
        durationHours
      }
    })
    if (res.ok) {
      setBanReason('')
      setBanHours('24')
      setDetailOpen(false)
    }
  }

  async function handleKick() {
    if (!selectedPlayer) return
    // Note: kick requires stationId which we don't have in this page context
    // This is a demonstration; real implementation would need StationScoped
    await api.request({
      endpointId: 'moderation.kick',
      params: { stationId: 'unknown' },
      body: { playerId: selectedPlayer.id }
    })
  }

  return (
    <div>
      <PageHeader
        title="Player Manager"
        subtitle="Search for players and manage their roles and permissions."
      />

      <form onSubmit={handleSearch} className="mb-4">
        <Field label="Search player">
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
        empty={<EmptyState title="No players found" hint="Use the search bar to find players." />}
      >
        {(raw) => {
          const found = asPlayers(raw)
          return (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {found.map((player) => (
                <button
                  key={player.id}
                  onClick={() => openDetail(player)}
                  className="card p-4 text-left hover:border-[var(--accent-2)] transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="font-medium">{player.displayName}</div>
                      <div className="text-[11px] text-[var(--text-faint)] mono">{player.id}</div>
                    </div>
                    {player.banned && <Badge tone="bad"><Lock size={10} /> banned</Badge>}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {player.roles?.map((role) => (
                      <Badge key={role} tone="accent">
                        {role}
                      </Badge>
                    ))}
                  </div>
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
          <>
            <PermissionGate scope="moderation">
              <Button variant="danger" onClick={() => void handleKick()}>
                <Zap size={14} /> Kick
              </Button>
            </PermissionGate>
            <Button variant="ghost" onClick={() => setDetailOpen(false)}>
              Close
            </Button>
          </>
        }
      >
        {selectedPlayer && (
          <div className="space-y-4">
            <JsonBlock value={selectedPlayer.raw} />

            <div className="space-y-3">
              <h3 className="font-medium flex items-center gap-2">
                <Shield size={14} /> Actions
              </h3>

              <PermissionGate scope="moderation">
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
                      Ban
                    </Button>
                  </div>
                </Card>
              </PermissionGate>

              <PermissionGate scope="role-management">
                <Card>
                  <div className="text-[13px]">
                    <p className="text-[var(--text-dim)] mb-2">Role assignment coming soon</p>
                  </div>
                </Card>
              </PermissionGate>
            </div>

            <div className="space-y-3">
              <h3 className="font-medium">Role history</h3>
              <EmptyState title="No records" />
            </div>

            <div className="space-y-3">
              <h3 className="font-medium">Ban history</h3>
              <EmptyState title="No records" />
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
