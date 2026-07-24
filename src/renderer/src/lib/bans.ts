/** Coerce the live bans payload ({ bans: [...] }) into a display shape. */

export interface Ban {
  id: string
  userId: string
  username?: string
  reason: string
  /** Free-text moderator note; the edit-ban endpoint calls this `comments`. */
  comments?: string
  /** Raw ban length as the API stores it — echoed back verbatim on edit so the
   *  ban's expiration is never altered. Unit/shape is the server's, not ours. */
  duration?: unknown
  /** epoch ms (the API sends ISO strings: `timestamp` / `expiration`) */
  bannedAt: number
  expiresAt?: number
  revoked?: boolean
}

function toMs(v: unknown): number | undefined {
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    // The API sends UTC, but the `expiration` field omits the trailing `Z` (while
    // `timestamp` includes it). Without a timezone, Date.parse treats it as local
    // time and an expired ban reads as still-active. Force UTC when none is given.
    const hasTz = /[zZ]$|[+-]\d\d:?\d\d$/.test(v)
    const s = v.includes('T') && !hasTz ? `${v}Z` : v
    const t = Date.parse(s)
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
    comments: typeof b.comments === 'string' ? b.comments : undefined,
    duration: b.duration,
    bannedAt: toMs(b.timestamp ?? b.banned_at ?? b.bannedAt) ?? 0,
    expiresAt: toMs(b.expiration ?? b.expires_at ?? b.expiresAt),
    revoked: typeof b.revoked === 'boolean' ? b.revoked : undefined
  }))
}
