/**
 * Resolve the winning team of a finished match from a `gamemode_stopped` event.
 *
 * The authoritative signal is the stop reason / trigger — the official dashboard shows it as
 * "Reason for Stop: team1 match win". When the reason doesn't name a team (time limit, manual
 * stop, unknown), fall back to comparing the two team scores. Returns null only when neither
 * source is usable.
 */
export type MatchWinner = 'team0' | 'team1' | 'tie' | null

export function matchResult(
  trigger: string | undefined,
  score0: number | undefined,
  score1: number | undefined
): MatchWinner {
  // "team0 match win" / "team1 match win" (case-insensitive, tolerant of extra words).
  const m = trigger?.toLowerCase().match(/team\s*([01])\b/)
  if (m) return m[1] === '0' ? 'team0' : 'team1'

  // Fall back to the scoreline when both scores are present.
  if (typeof score0 === 'number' && typeof score1 === 'number') {
    if (score0 > score1) return 'team0'
    if (score1 > score0) return 'team1'
    return 'tie'
  }
  return null
}

/** Convenience: the numeric winning team (0 | 1), or undefined for tie/unknown. */
export function winningTeam(
  trigger: string | undefined,
  score0: number | undefined,
  score1: number | undefined
): 0 | 1 | undefined {
  const r = matchResult(trigger, score0, score1)
  return r === 'team0' ? 0 : r === 'team1' ? 1 : undefined
}
