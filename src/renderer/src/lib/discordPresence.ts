import type { DiscordPrivacy, PresenceActivity } from '@shared/ipc'

export interface PresenceContext {
  /** Nav label of the current page, or null for an unknown route. */
  page: string | null
  fleetName: string | null
  stationName: string | null
}

const IDLE = 'Managing Orion Drift fleets'

/**
 * What each privacy level is allowed to publish. Levels are additive: every level only ever
 * reveals what the ones below it do, plus one more thing. IDs are never published at any level.
 */
export function presenceFor(level: DiscordPrivacy, ctx: PresenceContext): PresenceActivity | null {
  if (level === 'off') return null
  if (level === 'minimal') return { details: IDLE }

  const details = ctx.page ? `Viewing ${ctx.page}` : IDLE
  if (level === 'standard') return { details }

  const state = [ctx.fleetName, ctx.stationName].filter(Boolean).join(' · ')
  return state ? { details, state } : { details }
}
