import { useRef, useState } from 'react'
import { Search, User, Ban, CheckCircle2 } from 'lucide-react'
import { api } from '../../lib/api'
import { PageHeader, Card, Button, Badge, Field, EmptyState, JsonBlock, Spinner } from '../components/ui'
import { useAppStore } from '../../state/useAppStore'
import { ts, ago } from '../../lib/format'

interface Hit {
  id: string
  name: string
}

interface Profile {
  id: string
  name: string
  createdAt?: number
  lastLogin?: number
  banned?: boolean
  raw: unknown
}

function toMs(v: unknown): number | undefined {
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    const t = Date.parse(v)
    if (!Number.isNaN(t)) return t
  }
  return undefined
}

/** Global user_search returns { items: [{ user_id, display_name }] } (shape from the registry). */
function asHits(data: unknown): Hit[] {
  const arr = Array.isArray(data) ? data : (data as { items?: unknown[] })?.items ?? []
  return (arr as Record<string, unknown>[])
    .map((u) => ({
      id: String(u.user_id ?? u.id ?? ''),
      name: String(u.display_name ?? u.username ?? u.name ?? u.user_id ?? 'Unknown')
    }))
    .filter((h) => h.id)
}

function asProfile(data: unknown): Profile {
  const d = (data ?? {}) as Record<string, unknown>
  return {
    id: String(d.user_id ?? d.id ?? ''),
    name: String(d.display_name ?? d.username ?? d.name ?? d.user_id ?? 'Unknown'),
    createdAt: toMs(d.created_at ?? d.created),
    lastLogin: toMs(d.last_login ?? d.lastLogin),
    banned: typeof d.banned === 'boolean' ? d.banned : undefined,
    raw: data
  }
}

export default function PlayerLookupPage() {
  const showIds = useAppStore((s) => s.settings?.showIds ?? false)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<Hit[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState('')
  // Guards the profile load so a slower lookup can't land under a later-selected player.
  const activeIdRef = useRef<string | null>(null)

  async function search() {
    const q = query.trim()
    if (!q) return
    setSearching(true)
    setSearchError('')
    setHits(null)
    const res = await api.request({ endpointId: 'player.search', params: { search_string: q } })
    if (res.ok) {
      setHits(asHits(res.data))
    } else {
      setSearchError(res.error?.message ?? 'Search failed.')
      setHits([])
    }
    setSearching(false)
  }

  async function openProfile(hit: Hit) {
    activeIdRef.current = hit.id
    setProfile(null)
    setProfileError('')
    setProfileLoading(true)
    const res = await api.request({ endpointId: 'user.get', params: { userId: hit.id } })
    if (activeIdRef.current !== hit.id) return
    if (res.ok) {
      setProfile(asProfile(res.data))
    } else {
      // user.get needs GLOBAL user_data:read; fall back to the search result we already have.
      setProfile({ id: hit.id, name: hit.name, raw: null })
      setProfileError(res.error?.message ?? 'Could not load the full profile (needs global user_data:read).')
    }
    setProfileLoading(false)
  }

  return (
    <div>
      <PageHeader
        title="Player Lookup"
        subtitle="Find any player across the whole game by name or user id — no fleet needed."
      />

      <form
        className="mb-4"
        onSubmit={(e) => {
          e.preventDefault()
          void search()
        }}
      >
        <Field label="Search all players">
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
            <EmptyState title="Search for a player" hint="Results across every fleet appear here." />
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
                  {showIds && <span className="mono text-[11px] text-[var(--text-faint)] ml-auto">{hit.id}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          {profileLoading ? (
            <Card><Spinner label="Loading profile…" /></Card>
          ) : profile ? (
            <Card className="space-y-3">
              <div className="flex items-center gap-2">
                <User size={16} className="text-[var(--accent)]" />
                <span className="font-medium text-[15px]">{profile.name}</span>
                {profile.banned === true && <Badge tone="bad"><Ban size={11} /> banned</Badge>}
                {profile.banned === false && <Badge tone="good"><CheckCircle2 size={11} /> not banned</Badge>}
              </div>
              {showIds && <div className="mono text-[11px] text-[var(--text-faint)]">{profile.id}</div>}
              <div className="grid grid-cols-2 gap-2 text-[12px]">
                <div>
                  <div className="text-[var(--text-faint)]">Account created</div>
                  <div>{profile.createdAt ? ts(profile.createdAt, false) : '—'}</div>
                </div>
                <div>
                  <div className="text-[var(--text-faint)]">Last login</div>
                  <div>{profile.lastLogin ? ago(profile.lastLogin) : '—'}</div>
                </div>
              </div>
              {profileError && <p className="text-[12px] text-[var(--text-dim)]">{profileError}</p>}
              {profile.raw != null && <JsonBlock value={profile.raw} className="max-h-64" />}
            </Card>
          ) : (
            <EmptyState title="Select a player" hint="Pick a result to see their global profile." />
          )}
        </div>
      </div>
    </div>
  )
}
