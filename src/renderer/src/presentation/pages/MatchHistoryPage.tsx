import { useState, useMemo } from 'react'
import { RefreshCw, Download, Copy, ChevronRight } from 'lucide-react'
import type { MatchRecord } from '@shared/models'
import { useEndpoint } from '../../services/useEndpoint'
import { PageHeader, Button, Badge, Field, JsonBlock } from '../components/ui'
import { RequestResult } from '../components/RequestResult'
import { StationScoped } from '../components/StationScoped'
import { Modal } from '../components/Modal'
import { ts } from '../../lib/format'

function asMatches(data: unknown): MatchRecord[] {
  const arr = Array.isArray(data) ? data : (data as { matches?: unknown[] })?.matches ?? []
  return (arr as Record<string, unknown>[]).map((m) => ({
    id: String(m.id ?? m.matchId ?? ''),
    stationId: m.stationId as string | undefined,
    gamemode: String(m.gamemode ?? 'Unknown'),
    startedAt: Number(m.startedAt ?? 0),
    endedAt: Number(m.endedAt ?? 0),
    players: Array.isArray(m.players)
      ? (m.players as { id: string; displayName: string; score?: number }[])
      : undefined,
    serverStats: (m.serverStats as Record<string, unknown>) ?? {},
    raw: m
  }))
}

export default function MatchHistoryPage() {
  return (
    <div>
      <PageHeader title="Match History" subtitle="View historical match data and statistics." />
      <StationScoped>{(stationId) => <MatchViewer stationId={stationId} />}</StationScoped>
    </div>
  )
}

function MatchViewer({ stationId }: { stationId: string }) {
  const { data, response, loading, run } = useEndpoint<unknown>('matches.list', {
    params: { stationId },
    auto: true
  })
  const [searchTerm, setSearchTerm] = useState('')
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedMatch, setSelectedMatch] = useState<MatchRecord | null>(null)

  const matches = asMatches(data)

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return matches
    const lower = searchTerm.toLowerCase()
    return matches.filter(
      (m) =>
        m.id.toLowerCase().includes(lower) || (m.gamemode ?? '').toLowerCase().includes(lower)
    )
  }, [matches, searchTerm])

  function openDetail(match: MatchRecord) {
    setSelectedMatch(match)
    setDetailOpen(true)
  }

  async function copyPlayers() {
    if (!selectedMatch?.players) return
    const json = JSON.stringify(selectedMatch.players, null, 2)
    try {
      await navigator.clipboard.writeText(json)
    } catch {
      // silently ignore clipboard errors
    }
  }

  function exportMatch() {
    if (!selectedMatch) return
    const blob = new Blob([JSON.stringify(selectedMatch.raw, null, 2)], {
      type: 'application/json'
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `match-${selectedMatch.id}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <Button onClick={() => void run()} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Reload
        </Button>
      </div>

      <Field label="Search matches">
        <input
          className="input mb-4"
          placeholder="Gamemode or match ID…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </Field>

      <RequestResult response={response} loading={loading} onRetry={() => void run()}>
        {() => (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((match) => (
              <button
                key={match.id}
                onClick={() => openDetail(match)}
                className="card p-4 text-left hover:border-[var(--accent-2)] transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <Badge tone="accent">{match.gamemode || 'Unknown'}</Badge>
                    <div className="text-[11px] text-[var(--text-faint)] mono mt-1">{match.id}</div>
                  </div>
                  <ChevronRight size={16} className="text-[var(--text-faint)]" />
                </div>

                <div className="space-y-1 text-[12px]">
                  {(match.startedAt ?? 0) > 0 && (
                    <div className="text-[var(--text-dim)]">
                      Started: {ts(match.startedAt)}
                    </div>
                  )}
                  {(match.endedAt ?? 0) > 0 && (
                    <div className="text-[var(--text-dim)]">
                      Ended: {ts(match.endedAt)}
                    </div>
                  )}
                  {match.players && (
                    <div className="text-[var(--text-dim)]">
                      Players: {match.players.length}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </RequestResult>

      <Modal
        open={detailOpen}
        title={selectedMatch ? `Match ${selectedMatch.id}` : 'Match Details'}
        onClose={() => setDetailOpen(false)}
        wide
        footer={
          <>
            <Button variant="ghost" onClick={() => void copyPlayers()}>
              <Copy size={14} /> Copy players
            </Button>
            <Button variant="ghost" onClick={() => exportMatch()}>
              <Download size={14} /> Export
            </Button>
            <Button variant="ghost" onClick={() => setDetailOpen(false)}>
              Close
            </Button>
          </>
        }
      >
        {selectedMatch && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="label mb-1">Gamemode</div>
                <Badge tone="accent">{selectedMatch.gamemode || 'Unknown'}</Badge>
              </div>
              <div>
                <div className="label mb-1">Match ID</div>
                <div className="text-[12px] mono text-[var(--text-dim)]">{selectedMatch.id}</div>
              </div>
              <div>
                <div className="label mb-1">Started</div>
                <div className="text-[12px] text-[var(--text-dim)]">
                  {ts(selectedMatch.startedAt ?? 0)}
                </div>
              </div>
              <div>
                <div className="label mb-1">Ended</div>
                <div className="text-[12px] text-[var(--text-dim)]">
                  {ts(selectedMatch.endedAt ?? 0)}
                </div>
              </div>
            </div>

            {selectedMatch.players && selectedMatch.players.length > 0 && (
              <div>
                <h3 className="font-medium mb-2">Players</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="border-b border-[var(--border-soft)]">
                        <th className="text-left py-1.5 px-2">Player</th>
                        <th className="text-left py-1.5 px-2">ID</th>
                        <th className="text-left py-1.5 px-2">Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedMatch.players.map((p) => (
                        <tr key={p.id} className="border-b border-[var(--border-soft)]">
                          <td className="py-1.5 px-2">{p.displayName}</td>
                          <td className="py-1.5 px-2 mono text-[var(--text-dim)]">{p.id}</td>
                          <td className="py-1.5 px-2">{p.score ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {Object.keys(selectedMatch.serverStats ?? {}).length > 0 && (
              <div>
                <h3 className="font-medium mb-2">Server Stats</h3>
                <JsonBlock value={selectedMatch.serverStats} className="max-h-40" />
              </div>
            )}

            <div>
              <h3 className="font-medium mb-2">Raw Data</h3>
              <JsonBlock value={selectedMatch.raw} className="max-h-64" />
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
