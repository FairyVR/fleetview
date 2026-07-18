import { describe, it, expect } from 'vitest'
import { asBans } from '../src/renderer/src/lib/bans'

describe('asBans (live payload shape)', () => {
  it('parses the real { bans: [...] } shape with ISO timestamps', () => {
    const [b] = asBans({
      bans: [
        {
          ban_id: 'ban-1',
          user_id: '6807043526078982',
          username: 'SomePlayer',
          fleet_id: 'flt-1',
          timestamp: '2026-06-08T01:40:29.917967Z',
          expiration: null,
          reason: 'username',
          revoked: false,
          created_by: 'mod-1'
        }
      ]
    })
    expect(b.id).toBe('ban-1')
    expect(b.username).toBe('SomePlayer')
    expect(b.bannedAt).toBe(Date.parse('2026-06-08T01:40:29.917967Z'))
    expect(b.expiresAt).toBeUndefined() // null expiration = permanent
    expect(b.revoked).toBe(false)
  })

  it('still tolerates legacy numeric fields and bare arrays', () => {
    const [b] = asBans([{ id: 'x', userId: 'u', banned_at: 123, expires_at: 456 }])
    expect(b.bannedAt).toBe(123)
    expect(b.expiresAt).toBe(456)
  })
})
