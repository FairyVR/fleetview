/** Coerce the live bans payload ({ bans: [...] }) into a display shape. */

export interface Ban {
  id: string
  userId: string
  username?: string
  reason: string
  /** epoch ms (the API sends ISO strings: `timestamp` / `expiration`) */
  bannedAt: number
  expiresAt?: number
  revoked?: boolean
}

function toMs(v: unknown): number | undefined {
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    const t = Date.parse(v)
    if (!Number.isNaN(t)) return t
  }
  return undefined
}

export function asBans(data: unknown): Ban[] {
  const d = data as { bans?: unknown[]; items?: unknown[] } | unknown[]
  const arr = Array.isArray(d) ? d : (d?.bans ?? d?.items ?? [])
  return (arr as Record<string, unknown>[]).map((b) => ({
    id: String(b.ban_id ?? b.id ?? ''),
    userId: String(b.user_id ?? b.userId ?? ''),
    username: typeof b.username === 'string' ? b.username : undefined,
    reason: String(b.reason ?? ''),
    bannedAt: toMs(b.timestamp ?? b.banned_at ?? b.bannedAt) ?? 0,
    expiresAt: toMs(b.expiration ?? b.expires_at ?? b.expiresAt),
    revoked: typeof b.revoked === 'boolean' ? b.revoked : undefined
  }))
}
