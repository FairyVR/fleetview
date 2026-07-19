import { useState } from 'react'
import { RefreshCw, Trophy, ChevronDown, ChevronRight } from 'lucide-react'
import { useEndpoint } from '../../services/useEndpoint'
import { PageHeader, Card, Button, Badge, EmptyState, JsonBlock } from '../components/ui'
import { RequestResult } from '../components/RequestResult'
import { StationScoped } from '../components/StationScoped'
import { gamemodeDisplayName } from '../../lib/gamemodes'
import { ts } from '../../lib/format'

interface Match {
  id: string
  arena: string
  trigger?: string
  /** 0 | 1 from "teamN match win" triggers (bot-confirmed semantics). */
  winner?: 0 | 1
  score0?: number
  score1?: number
  players: Array<{ name: string; team?: number }>
  at?: number
  raw: unknown
}

/** Team membership when the event exposes it — the known payload often doesn't. */
function playerTeam(p: Record<string, unknown>): number | undefined {
  const t = [p.team, p.team_index, p.teamId, p.team_id].find((v) => typeof v === 'number')
  return t as number | undefined
}

/** gamemode_stopped events carry a JSON string in event_data (live-verified). */
function asMatches(data: unknown): Match[] {
  const arr = (data as { items?: unknown[] } | null)?.items
  return (Array.isArray(arr) ? arr : [])
    .map((e) => e as Record<string, unknown>)
    .map((e) => {
      let ed: Record<string, unknown> = {}
      try {
        ed = typeof e.event_data === 'string' ? JSON.parse(e.event_data) : (e.event_data as Record<string, unknown>) ?? {}
      } catch {
        // keep raw-only entry when event_data isn't parseable
      }
      const scores = (ed.scores ?? {}) as Record<string, unknown>
      const players = Array.isArray(ed.players) ? ed.players : []
      const at = typeof e.timestamp === 'string' ? Date.parse(e.timestamp) : NaN
      const trigger = typeof ed.event_trigger === 'string' ? ed.event_trigger : undefined
      const winner = trigger?.toLowerCase().startsWith('team0')
        ? (0 as const)
        : trigger?.toLowerCase().startsWith('team1')
          ? (1 as const)
          : undefined
      return {
        id: String(e.idx ?? ''),
        arena: gamemodeDisplayName(String(ed.slot_id ?? 'unknown')),
        trigger,
        winner,
        score0: typeof scores['0'] === 'number' ? (scores['0'] as number) : undefined,
        score1: typeof scores['1'] === 'number' ? (scores['1'] as number) : undefined,
        players: players
          .map((p) => p as Record<string, unknown>)
          .map((p) => ({ name: String(p?.name ?? ''), team: playerTeam(p) }))
          .filter((p) => p.name),
        at: Number.isNaN(at) ? undefined : at,
        raw: ed
      }
    })
}

export default function MatchHistoryPage() {
  return (
    <div>
      <PageHeader
        title="Match History"
        subtitle="Finished matches on the selected station, from gamemode_stopped server events."
      />
      <StationScoped>{(stationId) => <MatchList stationId={stationId} />}</StationScoped>
    </div>
  )
}

function MatchList({ stationId }: { stationId: string }) {
  const { response, loading, run } = useEndpoint<unknown>('events.station', {
    params: { stationId, event_type: 'gamemode_stopped', page_size: 50 },
    auto: true
  })
  const [openId, setOpenId] = useState<string | null>(null)

  return (
    <div>
      <div className="flex items-center mb-4">
        <Button onClick={() => void run()} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </Button>
      </div>
      <RequestResult
        response={response}
        loading={loading}
        onRetry={() => void run()}
        empty={<EmptyState icon={<Trophy size={22} />} title="No finished matches" hint="No gamemode_stopped events recorded for this station yet." />}
      >
        {(raw) => {
          const matches = asMatches(raw)
          if (!matches.length) {
            return <EmptyState icon={<Trophy size={22} />} title="No finished matches" hint="No gamemode_stopped events recorded for this station yet." />
          }
          return (
            <div className="grid gap-3">
              {matches.map((m) => (
                <Card key={m.id}>
                  <button
                    className="w-full text-left"
                    onClick={() => setOpenId(openId === m.id ? null : m.id)}
                  >
                    <div className="flex items-center gap-3 flex-wrap">
                      {openId === m.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      <Trophy size={15} className="text-[var(--accent)]" />
                      <span className="font-medium">{m.arena}</span>
                      {m.score0 !== undefined && m.score1 !== undefined && (
                        <Badge tone={m.winner !== undefined ? 'good' : 'accent'}>
                          {m.winner === 0 ? <b>{m.score0}</b> : m.score0} – {m.winner === 1 ? <b>{m.score1}</b> : m.score1}
                        </Badge>
                      )}
                      {m.trigger && <Badge>{m.trigger}</Badge>}
                      {m.at && <span className="text-[11px] text-[var(--text-dim)] ml-auto">{ts(m.at)}</span>}
                    </div>
                    {m.players.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2 ml-7">
                        {m.players.map((p) => (
                          <Badge
                            key={p.name}
                            tone={p.team !== undefined && p.team === m.winner ? 'good' : 'neutral'}
                          >
                            {p.name}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </button>
                  {openId === m.id && (
                    <div className="mt-3">
                      <JsonBlock value={m.raw} className="max-h-72" />
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )
        }}
      </RequestResult>
    </div>
  )
}
