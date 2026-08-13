import { describe, it, expect } from 'vitest'
import { assignFailureReason } from '../src/renderer/src/lib/roleAssign'
import type { ApiResponse } from '../src/shared/models'

const res = (over: Partial<ApiResponse<unknown>>): ApiResponse<unknown> => ({
  ok: false,
  status: 400,
  statusText: '',
  data: null,
  logId: 'l',
  durationMs: 1,
  ...over
})

describe('assignFailureReason', () => {
  it('explains the pending-grant conflict the dashboard cannot show', () => {
    const msg = assignFailureReason(
      res({
        status: 409,
        error: {
          kind: 'http-error',
          message: 'Already exists: User already has role or pending role with that role_id'
        }
      })
    )
    expect(msg).toContain('already has this role')
    expect(msg).toContain('pending')
  })

  it('reports an unknown username (the 200-with-user_exists:false shape)', () => {
    expect(assignFailureReason(res({ ok: true, status: 200, data: { user_exists: false } }))).toBe(
      'no player with that name exists'
    )
  })

  it('names a permission problem instead of echoing the API', () => {
    expect(
      assignFailureReason(res({ status: 403, error: { kind: 'permission-denied', message: '403' } }))
    ).toContain('not allowed to assign roles')
  })

  it('falls back to the raw message for anything unmapped', () => {
    expect(assignFailureReason(res({ status: 422, error: { kind: 'http-error', message: 'boom' } }))).toBe('boom')
  })
})
