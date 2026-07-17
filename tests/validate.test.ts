import { describe, it, expect } from 'vitest'
import { validateJson } from '../src/renderer/src/lib/validate'

describe('validateJson', () => {
  it('accepts valid JSON', () => {
    expect(validateJson('{"a":1}')).toBeNull()
  })
  it('accepts empty / whitespace as no-error', () => {
    expect(validateJson('   ')).toBeNull()
  })
  it('rejects malformed JSON with a message', () => {
    expect(validateJson('{bad}')).toBeTruthy()
  })
})
