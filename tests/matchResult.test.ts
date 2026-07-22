import { describe, it, expect } from 'vitest'
import { matchResult, winningTeam } from '../src/renderer/src/lib/matchResult'

describe('matchResult', () => {
  it('reads the winner from a "teamN match win" trigger', () => {
    expect(matchResult('team1 match win', 20, 21)).toBe('team1')
    expect(matchResult('team0 match win', 11, 6)).toBe('team0')
  })

  it('is case- and spacing-tolerant on the trigger', () => {
    expect(matchResult('TEAM0 Match Win', undefined, undefined)).toBe('team0')
    expect(matchResult('team 1 win', undefined, undefined)).toBe('team1')
  })

  it('trusts the trigger even when it disagrees with the scoreline', () => {
    // e.g. a forfeit: team0 credited the win despite trailing on score.
    expect(matchResult('team0 match win', 3, 9)).toBe('team0')
  })

  it('falls back to scores when the trigger names no team', () => {
    expect(matchResult('time limit reached', 15, 9)).toBe('team0')
    expect(matchResult('time limit reached', 9, 15)).toBe('team1')
    expect(matchResult(undefined, 7, 7)).toBe('tie')
  })

  it('returns null when neither trigger nor scores are usable', () => {
    expect(matchResult(undefined, undefined, undefined)).toBeNull()
    expect(matchResult('match ended', undefined, 4)).toBeNull()
  })

  it('winningTeam maps to 0/1 and undefined for tie/unknown', () => {
    expect(winningTeam('team1 match win', 0, 1)).toBe(1)
    expect(winningTeam(undefined, 5, 5)).toBeUndefined()
    expect(winningTeam(undefined, undefined, undefined)).toBeUndefined()
  })
})
