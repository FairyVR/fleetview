import { useRef, useState } from 'react'
import { Search, Lock, Shield } from 'lucide-react'
import { api } from '../../lib/api'
import { useEndpoint } from '../../services/useEndpoint'
import { PageHeader, Card, Button, Badge, Field, EmptyState, JsonBlock } from '../components/ui'
import { RequestResult } from '../components/RequestResult'
import { PermissionGate } from '../components/PermissionGate'
import { FleetScoped } from '../components/FleetScoped'
import { Modal } from '../components/Modal'
import { asBans, type Ban } from '../../lib/bans'
import { loadUserRoles, type FleetRole } from '../../lib/fleetUsers'
import { ago } from '../../lib/format'
import { isOnline } from '../../lib/presence'
import { useAppStore } from '../../state/useAppStore'

interface Player {
  id: string
  displayName: string
  lastLogin?: number
  roles?: string[]
}

function asPlayers(data: unknown): Player[] {
  const arr = Array.isArray(data) ? data : (data as { items?: unknown[] })?.items ?? []
  return (arr as Record<string, unknown>[]).map((p) => {
    const last = typeof p.last_login === 'string' ? Date.parse(p.last_login) : NaN
    return {
      // Live API names the player in `username` — the old fallbacks made everyone "Unknown".
      id: String(p.user_id ?? p.id ?? ''),
      displayName: String(p.username ?? p.display_name ?? p.displayName ?? p.name ?? 'Unknown'),
      lastLogin: Number.isNaN(last) ? undefined : last,
      roles: Array.isArray(p.roles) ? (p.roles as string[]).map(String) : undefined
    }
  })
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
  const showIds = useAppStore((s) => s.settings?.showIds ?? false)
  const { response, loading, run } = useEndpoint<unknown>('player.listByFleet', {
    params: { fleetId, page_size: 100 },
    auto: true
  })
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null)
  const [banReason, setBanReason] = useState('')
  const [banHours, setBanHours] = useState('24')
  const [banHistory, setBanHistory] = useState<Ban[]>([])
  const [loadingBans, setLoadingBans] = useState(false)
  const [profile, setProfile] = useState<unknown>(null)
  const [playerRoles, setPlayerRoles] = useState<FleetRole[] | null>(null)
  const [banResult, setBanResult] = useState<{ ok: boolean; message: string } | null>(null)
  // Which player the open modal is for: guards the several async loads below so a slower
  // response for a previously-opened player can't land under the currently-open one.
  const activeIdRef = useRef<string | null>(null)

  function handleSearch(e: React.FormEvent) {
    e.preventDefault() // filtering is client-side over the loaded list
  }

  async function openDetail(player: Player) {
    activeIdRef.current = player.id
    setSelectedPlayer(player)
    setProfile(null)
    setPlayerRoles(null)
    setBanResult(null)
    setBanHistory([])
    setDetailOpen(true)
    setLoadingBans(true)
    const isCurrent = () => activeIdRef.current === player.id
    // Roles aren't on the player payload (API returns roles:null), so cross-reference role members.
    void loadUserRoles(fleetId, player.id)
      .then((roles) => isCurrent() && setPlayerRoles(roles))
      .catch(() => isCurrent() && setPlayerRoles([]))
    // Global profile (user.get is the confirmed v2 endpoint; fleet player lists may 404).
    void api
      .request({ endpointId: 'user.get', params: { userId: player.id } })
      .then((res) => {
        if (isCurrent() && res.ok) setProfile(res.data)
      })
      .catch(() => {})
    try {
      const res = await api.request({
        endpointId: 'player.bans',
        params: { fleetId, userId: player.id }
      })
      if (isCurrent()) setBanHistory(asBans(res.data))
    } catch {
      /* leave ban history empty */
    } finally {
      if (isCurrent()) setLoadingBans(false)
    }
  }

  async function handleBan() {
    if (!selectedPlayer || !banReason.trim()) return
    const durationHours = parseInt(banHours, 10)
    if (!Number.isFinite(durationHours) || durationHours < 1) {
      setBanResult({ ok: false, message: 'Duration must be a whole number of hours ≥ 1.' })
      return
    }
    setBanResult(null)
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
    } else {
      setBanResult({ ok: false, message: res.error?.message ?? 'Ban failed.' })
    }
  }

  return (
    <div>
      <form onSubmit={handleSearch} className="mb-4">
        <Field label="Search players">
          <div className="flex gap-2">
            <input
              className="input flex-1"
              placeholder="Filter by player name…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <Button variant="primary" onClick={() => void run()} disabled={loading}>
              <Search size={14} /> Refresh
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
          // Most recently seen first, matching the dashboard's players page.
          const found = asPlayers(raw)
            .filter((p) => !query.trim() || p.displayName.toLowerCase().includes(query.trim().toLowerCase()))
            .sort((a, b) => (b.lastLogin ?? 0) - (a.lastLogin ?? 0))
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
                      <div className="font-medium flex items-center gap-2">
                        {player.displayName}
                        {isOnline(player.lastLogin) ? (
                          <Badge tone="good">Online</Badge>
                        ) : (
                          <span className="text-[10.5px] text-[var(--text-faint)]">Offline</span>
                        )}
                      </div>
                      {showIds && <div className="text-[11px] text-[var(--text-faint)] mono">{player.id}</div>}
                      {player.lastLogin && !isOnline(player.lastLogin) && (
                        <div className="text-[11px] text-[var(--text-dim)]">last seen {ago(player.lastLogin)}</div>
                      )}
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
            <JsonBlock value={profile ?? selectedPlayer} />

            <div className="space-y-3">
              <h3 className="font-medium flex items-center gap-2">
                <Shield size={14} /> Roles
              </h3>
              {playerRoles === null ? (
                <p className="text-[12px] text-[var(--text-dim)]">Loading…</p>
              ) : playerRoles.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {playerRoles.map((role) => (
                    <Badge key={role.id} tone="accent">
                      {role.name}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-[12px] text-[var(--text-dim)]">No roles</p>
              )}
            </div>

            {playerRoles && playerRoles.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-medium flex items-center gap-2">
                  <Lock size={14} /> Effective permissions
                </h3>
                {(() => {
                  const perms = [...new Set(playerRoles.flatMap((r) => r.permissions))].sort()
                  return perms.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {perms.map((perm) => (
                        <Badge key={perm}>{perm}</Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[12px] text-[var(--text-dim)]">No permissions</p>
                  )
                })()}
              </div>
            )}

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
                    {banResult && !banResult.ok && (
                      <p className="text-[12px] text-[var(--danger,#f87171)]">{banResult.message}</p>
                    )}
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
