import { describe, it, expect } from 'vitest'
import { normalizeLeCode } from '../src/renderer/src/lib/leFormat'

describe('normalizeLeCode', () => {
  it('adds commas to every content line except the last', () => {
    const input = '"a": 1\n"b": true\n"c": "x"'
    expect(normalizeLeCode(input)).toBe('"a": 1,\n"b": true,\n"c": "x"')
  })

  it('is idempotent and strips duplicate trailing commas', () => {
    const once = normalizeLeCode('"a": 1,,\n"b": 2,')
    expect(once).toBe('"a": 1,\n"b": 2')
    expect(normalizeLeCode(once)).toBe(once)
  })

  it('leaves blank lines and lone braces alone', () => {
    const input = '{\n"a": 1\n\n"b": 2\n}'
    expect(normalizeLeCode(input)).toBe('{\n"a": 1,\n\n"b": 2\n}')
  })

  it('handles a single line without adding a comma', () => {
    expect(normalizeLeCode('"only": true')).toBe('"only": true')
  })
})
