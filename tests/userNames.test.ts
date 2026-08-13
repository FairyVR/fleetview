// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'

// api.ts reads window.api at import time, so stub it before importing the module under test.
const request = vi.fn()
;(globalThis as unknown as { window: Record<string, unknown> }).window ??= {}
;(window as unknown as { api: unknown }).api = { request }

const { resolveUserNames } = await import('../src/renderer/src/lib/userNames')

beforeEach(() => request.mockReset())

/** Each test uses a fresh fleetId — the roster cache is module-level and per-fleet. */
describe('resolveUserNames', () => {
  it('resolves from the fleet roster with a single request', async () => {
    request.mockResolvedValue({ data: { items: [{ user_id: 'm1', username: 'Nova' }] } })
    const names = await resolveUserNames('flt-roster', ['m1', 'm1'])
    expect(names.get('m1')).toBe('Nova')
    expect(request).toHaveBeenCalledTimes(1) // deduped, and no user.get needed
  })

  it('falls back to user.get for IDs the roster does not know', async () => {
    request.mockImplementation((args) =>
      (args ?? {}).endpointId === 'player.listByFleet'
        ? Promise.resolve({ data: { items: [] } })
        : Promise.resolve({ data: { user_id: 'm2', display_name: 'Ivy' } })
    )
    const names = await resolveUserNames('flt-fallback', ['m2'])
    expect(names.get('m2')).toBe('Ivy')
  })

  it('omits IDs that resolve to nothing instead of throwing', async () => {
    request.mockImplementation((args) => {
      const id = (args ?? {}).endpointId
      if (id === 'player.listByFleet') return Promise.reject(new Error('403'))
      if (id === 'user.get') return Promise.reject(new Error('401 Invalid Permissions'))
      return Promise.resolve({ data: null })
    })
    const names = await resolveUserNames('flt-denied', ['m3'])
    expect(names.has('m3')).toBe(false)
  })

  it('makes no requests for an empty id list', async () => {
    expect((await resolveUserNames('flt-empty', ['', ''])).size).toBe(0)
    expect(request).not.toHaveBeenCalled()
  })
})
