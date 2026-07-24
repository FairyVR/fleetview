import { useRef, useState } from 'react'
import { Search, User, Shield } from 'lucide-react'
import { api } from '../../lib/api'
import { loadFleetUsers, loadUserRoles, type FleetRole } from '../../lib/fleetUsers'
import { PageHeader, Card, Button, Badge, Field, EmptyState, JsonBlock, Spinner } from '../components/ui'
import { useAppStore } from '../../state/useAppStore'
import { ago } from '../../lib/format'

interface FleetRef {
  id: string
  name: string
}

interface Hit {
  id: string
  name: string
  /** Fleets this player was found in. */
  fleets: FleetRef[]
}

/** One fleet's view of the player: their fleet user record + the roles they hold there. */
interface FleetProfile {
  fleet: FleetRef
  roles: FleetRole[] | null
  lastLogin?: number
  raw: unknown
  error?: string
}

interface Profile {
  id: string
  name: string
  fleets: FleetProfile[]
}

function toMs(v: unknown): number | undefined {
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    const t = Date.parse(v)
    if (!Number.isNaN(t)) return t
  }
  return undefined
}

/** Every fleet the key can reach (fleet.list already returns only those). */
async function loadAccessibleFleets(): Promise<FleetRef[] | { error: string }> {
  const fleetsRes = await api.request({
    endpointId: 'fleet.list',
    params: { include_stations: false, include_config: false, include_offline_fleets: false, page_size: 32, page: 1 }
  })
  if (!fleetsRes.ok) return { error: fleetsRes.error?.message ?? 'Could not load your fleets.' }
  const d = fleetsRes.data as { fleets?: unknown[]; items?: unknown[] } | unknown[]
  return (Array.isArray(d) ? d : (d?.fleets ?? d?.items ?? []))
    .map((f) => f as Record<string, unknown>)
    .map((f) => ({ id: String(f.fleet_id ?? f.id ?? ''), name: String(f.fleet_name ?? f.name ?? f.fleet_id ?? '') }))
    .filter((f) => f.id)
}

/**
 * Search every fleet the key can reach and pool the matches: per-fleet user list in
 * parallel → dedupe by user id, remembering which fleets each player was seen in.
 * Fleets whose user list fails (no user_data:read there) are silently skipped — the server
 * decides access, we never pre-deny.
 */
async function searchAcrossFleets(fleets: FleetRef[], query: string): Promise<Hit[]> {
  const q = query.toLowerCase()
  const byId = new Map<string, Hit>()
  await Promise.all(
    fleets.map(async (fleet) => {
      const users = await loadFleetUsers(fleet.id).catch(() => [])
      for (const u of users) {
        if (u.id !== query && !u.name.toLowerCase().includes(q)) continue
        const hit = byId.get(u.id)
        if (hit) hit.fleets.push(fleet)
        else byId.set(u.id, { id: u.id, name: u.name, fleets: [fleet] })
      }
    })
  )
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Load the player's record in one fleet: fleet-scoped user data (fleet-level
 * user_data:read is enough — no global scope needed) plus the roles they hold there.
 */
async function loadFleetProfile(fleet: FleetRef, userId: string): Promise<FleetProfile> {
  const [res, roles] = await Promise.all([
    api.request({ endpointId: 'player.get', params: { fleetId: fleet.id, userId } }),
    loadUserRoles(fleet.id, userId).catch(() => null)
  ])
  const d = (res.ok ? res.data : {}) as Record<string, unknown>
  return {
    fleet,
    roles,
    lastLogin: toMs(d.last_login ?? d.lastLogin),
    raw: res.ok ? res.data : null,
    error: res.ok ? undefined : res.error?.message ?? 'Could not load the fleet user record.'
  }
}

/** Union of all permissions the player's roles grant in one fleet, sorted. */
function fleetPermissions(roles: FleetRole[]): string[] {
  return [...new Set(roles.flatMap((r) => r.permissions))].sort()
}

export default function PlayerLookupPage() {
  const showIds = useAppStore((s) => s.settings?.showIds ?? false)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<Hit[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  // Guards the profile load so a slower lookup can't land under a later-selected player.
  const activeIdRef = useRef<string | null>(null)
  // Accessible fleets from the last search, so the profile can check ALL of them.
  const fleetsRef = useRef<FleetRef[]>([])

  async function search() {
    const q = query.trim()
    if (!q) return
    setSearching(true)
    setSearchError('')
    setHits(null)
    const fleets = await loadAccessibleFleets()
    if (!Array.isArray(fleets)) {
      setSearchError(fleets.error)
      setHits([])
    } else if (!fleets.length) {
      setSearchError('The active key has no fleets to search.')
      setHits([])
    } else {
      fleetsRef.current = fleets
      setHits(await searchAcrossFleets(fleets, q))
    }
    setSearching(false)
  }

  async function openProfile(hit: Hit) {
    activeIdRef.current = hit.id
    setProfile(null)
    setProfileLoading(true)
    // Check every accessible fleet, not just the ones the search matched in.
    const all = await Promise.all(fleetsRef.current.map((f) => loadFleetProfile(f, hit.id)))
    if (activeIdRef.current !== hit.id) return
    // Keep fleets with an actual record or roles; drop the ones with nothing to show.
    const fleets = all.filter((fp) => fp.raw != null || (fp.roles?.length ?? 0) > 0)
    setProfile({ id: hit.id, name: hit.name, fleets })
    setProfileLoading(false)
  }

  return (
    <div>
      <PageHeader
        title="Player Lookup"
        subtitle="Search players by name or user id across every fleet your key can access, pooled into one list."
      />

      <form
        className="mb-4"
        onSubmit={(e) => {
          e.preventDefault()
          void search()
        }}
      >
        <Field label="Search players in your fleets">
          <div className="flex gap-2">
            <input
              className="input flex-1"
              placeholder="Player name or user id…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <Button variant="primary" type="submit" disabled={!query.trim() || searching}>
              <Search size={14} /> {searching ? 'Searching…' : 'Search'}
            </Button>
          </div>
        </Field>
      </form>

      {searchError && <Card className="text-[13px] text-[var(--bad)] mb-4">{searchError}</Card>}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-4 items-start">
        <div>
          {hits === null ? (
            <EmptyState title="Search for a player" hint="Pooled results from every fleet you can access appear here." />
          ) : hits.length === 0 ? (
            <EmptyState title="No players found" hint="Try a different name or the exact user id." />
          ) : (
            <div className="grid gap-2">
              {hits.map((hit) => (
                <button
                  key={hit.id}
                  onClick={() => void openProfile(hit)}
                  className={`card p-3 text-left flex items-center gap-2 hover:border-[var(--accent-2)] transition-colors ${
                    profile?.id === hit.id ? 'border-[var(--accent)]' : ''
                  }`}
                >
                  <User size={14} className="text-[var(--accent)]" />
                  <span className="font-medium">{hit.name}</span>
                  <span className="flex flex-wrap gap-1 ml-auto">
                    {hit.fleets.map((f) => (
                      <Badge key={f.id}>{f.name}</Badge>
                    ))}
                  </span>
                  {showIds && <span className="mono text-[11px] text-[var(--text-faint)]">{hit.id}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          {profileLoading ? (
            <Card><Spinner label="Loading fleet records…" /></Card>
          ) : profile ? (
            <div className="grid gap-3">
              <Card className="flex items-center gap-2">
                <User size={16} className="text-[var(--accent)]" />
                <span className="font-medium text-[15px]">{profile.name}</span>
                {showIds && <span className="mono text-[11px] text-[var(--text-faint)] ml-auto">{profile.id}</span>}
              </Card>
              {profile.fleets.map((fp) => (
                <Card key={fp.fleet.id} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{fp.fleet.name}</span>
                    {fp.lastLogin != null && (
                      <span className="text-[11px] text-[var(--text-faint)] ml-auto">last login {ago(fp.lastLogin)}</span>
                    )}
                  </div>
                  {fp.roles === null ? (
                    <span className="text-[12px] text-[var(--text-dim)]">Roles unavailable in this fleet.</span>
                  ) : fp.roles.length === 0 ? (
                    <span className="text-[12px] text-[var(--text-dim)]">No roles held in this fleet.</span>
                  ) : (
                    <>
                      <div>
                        <div className="text-[11px] text-[var(--text-faint)] mb-1">Roles in this fleet</div>
                        <div className="flex flex-wrap gap-1.5">
                          {fp.roles.map((r) => (
                            <Badge key={r.id} tone="accent">
                              <Shield size={11} /> {r.name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-[var(--text-faint)] mb-1">Permissions in this fleet</div>
                        <div className="flex flex-wrap gap-1.5">
                          {fleetPermissions(fp.roles).length === 0 ? (
                            <span className="text-[12px] text-[var(--text-dim)]">None listed on these roles.</span>
                          ) : (
                            fleetPermissions(fp.roles).map((p) => (
                              <span key={p} className="mono text-[11px] px-1.5 py-0.5 rounded bg-[var(--bg-elev-2)]">
                                {p}
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                    </>
                  )}
                  {fp.error && <p className="text-[12px] text-[var(--text-dim)]">{fp.error}</p>}
                  {fp.raw != null && <JsonBlock value={fp.raw} className="max-h-48" />}
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState title="Select a player" hint="Pick a result to see their record in each fleet." />
          )}
        </div>
      </div>
    </div>
  )
}
