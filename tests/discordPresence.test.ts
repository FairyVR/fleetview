import { describe, it, expect } from 'vitest'
import { presenceFor } from '../src/renderer/src/lib/discordPresence'

const ctx = { page: 'Moderation', fleetName: 'Ambit', stationName: 'Alpha' }

describe('presenceFor', () => {
  it('publishes nothing when off', () => {
    expect(presenceFor('off', ctx)).toBeNull()
  })

  it('leaks neither page nor names at minimal', () => {
    const a = presenceFor('minimal', ctx)!
    expect(JSON.stringify(a)).not.toMatch(/Moderation|Ambit|Alpha/)
  })

  it('shows the page but no names at standard', () => {
    const a = presenceFor('standard', ctx)!
    expect(a.details).toBe('Viewing Moderation')
    expect(a.state).toBeUndefined()
  })

  it('shows fleet and station at detailed', () => {
    expect(presenceFor('detailed', ctx)).toEqual({
      details: 'Viewing Moderation',
      state: 'Ambit · Alpha'
    })
  })

  it('omits the state line when nothing is selected', () => {
    const a = presenceFor('detailed', { page: 'Dashboard', fleetName: null, stationName: null })!
    expect(a.state).toBeUndefined()
  })

  it('falls back to a generic line on an unknown route', () => {
    expect(presenceFor('standard', { ...ctx, page: null })!.details).toBe('Managing Orion Drift fleets')
  })
})
