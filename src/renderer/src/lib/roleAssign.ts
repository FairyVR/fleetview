import type { ApiResponse } from '@shared/models'

/**
 * Turn a failed `roles.assign` call into something a fleet admin can act on. The API's own
 * strings are internal ("Already exists: User already has role or pending role with that
 * role_id"), so map the ones we've actually seen and fall back to the raw text otherwise.
 */
export function assignFailureReason(res: ApiResponse<unknown>): string {
  const exists = (res.data as { user_exists?: boolean } | null)?.user_exists
  if (res.ok && exists === false) return 'no player with that name exists'

  const raw = res.error?.message ?? ''
  const lower = raw.toLowerCase()

  // The common confusing one: a *pending* grant already exists. Roles assigned to someone who
  // hasn't joined the fleet since stay pending, and the dashboard only lists roles on players
  // it knows — so the role looks absent while the API still counts it as taken.
  if (res.status === 409 || lower.includes('already has role') || lower.includes('already exists'))
    return 'already has this role — a pending grant counts, and pending grants do not show on the dashboard until the player next joins the fleet'

  switch (res.error?.kind) {
    case 'permission-denied':
      return 'your key is not allowed to assign roles in this fleet'
    case 'not-found':
      return 'the fleet or role no longer exists — refresh the roles list'
    case 'rate-limited':
      return 'the API is rate-limiting this key — wait a moment and retry the rest'
    case 'timeout':
    case 'network':
    case 'offline':
      return 'could not reach the API — check your connection and retry'
  }
  return raw || `HTTP ${res.status}`
}
