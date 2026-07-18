import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Rocket } from 'lucide-react'
import { useSelectionStore } from '../../state/useSelectionStore'
import { Badge, Button, EmptyState } from './ui'

/**
 * Wrapper for fleet-scoped modules. In the real Orion Drift API, players, roles, bans,
 * reports and events all live under /fleets/{fleet_id}/… so a fleet must be selected.
 */
export function FleetScoped({ children }: { children: (fleetId: string) => ReactNode }) {
  const { fleetId, fleetName } = useSelectionStore()
  const navigate = useNavigate()

  if (!fleetId) {
    return (
      <EmptyState
        icon={<Rocket size={22} />}
        title="No fleet selected"
        hint="This module is scoped to a fleet. Pick one in the Fleet Explorer."
        action={
          <Button variant="primary" onClick={() => navigate('/fleets')}>
            Go to Fleet Explorer
          </Button>
        }
      />
    )
  }
  return (
    <div>
      <div className="mb-4">
        <Badge tone="accent">
          <Rocket size={11} /> {fleetName ?? fleetId}
        </Badge>
      </div>
      {children(fleetId)}
    </div>
  )
}
