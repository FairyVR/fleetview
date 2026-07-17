import type { ReactNode } from 'react'
import { AlertTriangle, WifiOff, Lock, Clock, KeyRound } from 'lucide-react'
import type { ApiResponse } from '@shared/models'
import { useAppStore } from '../../state/useAppStore'
import { Spinner, EmptyState, Button, Badge } from './ui'

/**
 * Renders the standard lifecycle for an endpoint call: loading / typed error / data.
 * Error rendering embeds the required UX: permission-denied shows the missing scope and
 * suggests switching keys; network errors surface offline guidance.
 */
export function RequestResult<T>({
  response,
  loading,
  onRetry,
  children,
  empty
}: {
  response: ApiResponse<T> | null
  loading: boolean
  onRetry?: () => void
  children: (data: T) => ReactNode
  empty?: ReactNode
}) {
  const keys = useAppStore((s) => s.keys)

  if (loading && !response) return <Spinner />
  if (!response) return <>{empty ?? <EmptyState title="No data yet" hint="Run the request to load data." />}</>

  if (response.error) {
    const e = response.error
    const icon =
      e.kind === 'offline' || e.kind === 'network' ? (
        <WifiOff size={22} />
      ) : e.kind === 'permission-denied' ? (
        <Lock size={22} />
      ) : e.kind === 'timeout' || e.kind === 'rate-limited' ? (
        <Clock size={22} />
      ) : e.kind === 'auth-expired' ? (
        <KeyRound size={22} />
      ) : (
        <AlertTriangle size={22} />
      )
    return (
      <EmptyState
        icon={icon}
        title={errorTitle(e.kind)}
        hint={e.message}
        action={
          <div className="flex flex-col items-center gap-3">
            {e.missingPermission && <Badge tone="bad">missing: {e.missingPermission}</Badge>}
            {e.kind === 'permission-denied' && keys.length > 1 && (
              <span className="text-[12px] text-[var(--text-dim)]">
                Try switching to another stored key from the sidebar.
              </span>
            )}
            {onRetry && e.kind !== 'permission-denied' && (
              <Button onClick={onRetry}>Retry</Button>
            )}
          </div>
        }
      />
    )
  }

  if (response.data == null || (Array.isArray(response.data) && response.data.length === 0)) {
    return <>{empty ?? <EmptyState title="Empty response" hint="The server returned no items." />}</>
  }

  return <>{children(response.data)}</>
}

function errorTitle(kind: string): string {
  switch (kind) {
    case 'permission-denied':
      return 'Permission denied'
    case 'network':
    case 'offline':
      return 'Cannot reach the server'
    case 'timeout':
      return 'Request timed out'
    case 'rate-limited':
      return 'Rate limited'
    case 'auth-expired':
      return 'Authentication failed'
    case 'not-found':
      return 'Not found'
    default:
      return 'Request failed'
  }
}
