import type { ReactNode } from 'react'
import { Lock } from 'lucide-react'
import { useAppStore } from '../../state/useAppStore'
import { Badge } from './ui'

/**
 * Gates children behind the active key's discovered permission for `scope`.
 * - allowed  → render children
 * - denied   → render a disabled notice (never expose the action)
 * - unknown  → render children (can't pre-judge; the API client still enforces)
 */
export function PermissionGate({
  scope,
  children,
  hideWhenDenied
}: {
  scope: string
  children: ReactNode
  hideWhenDenied?: boolean
}) {
  const state = useAppStore((s) => s.permissionState(scope))
  if (state === 'denied') {
    if (hideWhenDenied) return null
    return (
      <Badge tone="bad">
        <Lock size={11} /> requires {scope}
      </Badge>
    )
  }
  return <>{children}</>
}
