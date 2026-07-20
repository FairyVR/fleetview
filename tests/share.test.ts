import { describe, it, expect } from 'vitest'
import { mergeSharedConfig } from '../src/shared/models/library'
import type { SharedLeConfig } from '../src/shared/models/library'

function cfg(id: string, name: string): SharedLeConfig {
  return { id, name, code: 'x', tags: [], sharedBy: 'tester', sharedAt: 0 }
}

describe('mergeSharedConfig', () => {
  it('appends a new config', () => {
    const result = mergeSharedConfig([cfg('a', 'Arena A')], cfg('b', 'Arena B'))
    expect(result.map((c) => c.id)).toEqual(['a', 'b'])
  })

  it('replaces an existing config with the same id instead of duplicating it', () => {
    const result = mergeSharedConfig([cfg('a', 'Arena A'), cfg('b', 'Arena B')], cfg('a', 'Arena A (updated)'))
    expect(result).toHaveLength(2)
    expect(result.find((c) => c.id === 'a')?.name).toBe('Arena A (updated)')
  })
})
