import { describe, expect, it } from 'vitest'
import { isOnline, ONLINE_WINDOW_MS } from '../src/renderer/src/lib/presence'

const NOW = Date.parse('2026-07-19T16:00:00Z')

describe('isOnline', () => {
  it('last_login within the window = online', () => {
    expect(isOnline(NOW - 60_000, NOW)).toBe(true)
    expect(isOnline(NOW, NOW)).toBe(true)
  })

  it('last_login older than the window = offline', () => {
    expect(isOnline(NOW - ONLINE_WINDOW_MS - 1000, NOW)).toBe(false)
  })

  it('missing last_login = offline', () => {
    expect(isOnline(undefined, NOW)).toBe(false)
  })
})
