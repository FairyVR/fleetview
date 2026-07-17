import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Server } from 'lucide-react'
import { useSelectionStore } from '../../state/useSelectionStore'
import { Badge, Button, EmptyState } from './ui'

/**
 * Wrapper for station-scoped modules. Renders a prompt to pick a station when none is
 * selected; otherwise passes the selected stationId to children.
 */
export function StationScoped({ children }: { children: (stationId: string) => ReactNode }) {
  const { stationId, stationName } = useSelectionStore()
  const navigate = useNavigate()

  if (!stationId) {
    return (
      <EmptyState
        icon={<Server size={22} />}
        title="No station selected"
        hint="Pick a station in the Station Manager to work with this module."
        action={<Button variant="primary" onClick={() => navigate('/stations')}>Go to Station Manager</Button>}
      />
    )
  }
  return (
    <div>
      <div className="mb-4">
        <Badge tone="accent">
          <Server size={11} /> {stationName ?? stationId}
        </Badge>
      </div>
      {children(stationId)}
    </div>
  )
}
