import { useState } from 'react'
import { Shield, RefreshCw, Send } from 'lucide-react'
import { api } from '../../lib/api'
import { useEndpoint } from '../../services/useEndpoint'
import { PageHeader, Card, Button, Badge, Field } from '../components/ui'
import { RequestResult } from '../components/RequestResult'
import { PermissionGate } from '../components/PermissionGate'
import { FleetScoped } from '../components/FleetScoped'

interface Role {
  id: string
  name: string
  description?: string
  permissions: string[]
}

function asRoles(data: unknown): Role[] {
  const arr = Array.isArray(data) ? data : (data as { roles?: unknown[] })?.roles ?? []
  return (arr as Record<string, unknown>[]).map((r) => ({
    id: String(r.role_id ?? r.id ?? ''),
    name: String(r.role_name ?? r.name ?? 'Unknown'),
    description: (r.role_description ?? r.description) as string | undefined,
    permissions: Array.isArray(r.permissions) ? (r.permissions as string[]) : []
  }))
}

export default function RolesPage() {
  return (
    <div>
      <PageHeader
        title="Roles"
        subtitle="Manage user roles and permissions."
      />
      <FleetScoped>{(fleetId) => <RolesEditor fleetId={fleetId} />}</FleetScoped>
    </div>
  )
}

function RolesEditor({ fleetId }: { fleetId: string }) {
  const { data, response, loading, run } = useEndpoint<unknown>('roles.list', {
    params: { fleetId },
    auto: true
  })
  const [userId, setUserId] = useState('')
  const [selectedRole, setSelectedRole] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [lastResult, setLastResult] = useState<{ ok: boolean; message: string } | null>(null)

  const roles = asRoles(data)

  async function handleAssign() {
    if (!userId.trim() || !selectedRole.trim()) return

    setAssigning(true)
    try {
      const res = await api.request({
        endpointId: 'roles.assign',
        params: { fleetId, userId, roleId: selectedRole }
      })
      setLastResult({
        ok: res.ok,
        message: res.ok ? `Role assigned to ${userId}` : 'Failed to assign role'
      })
      if (res.ok) {
        setUserId('')
        setSelectedRole('')
      }
      setTimeout(() => setLastResult(null), 2000)
    } finally {
      setAssigning(false)
    }
  }

  return (
    <div>
      <div className="flex items-center mb-4">
        <Button onClick={() => void run()}><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <RequestResult response={response} loading={loading} onRetry={() => void run()}>
          {(raw) => (
            <div className="lg:col-span-2 space-y-4">
              {asRoles(raw).map((role) => (
                <Card key={role.id}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Shield size={16} className="text-[var(--accent)]" />
                      <div>
                        <div className="font-medium">{role.name}</div>
                        <div className="text-[11px] text-[var(--text-faint)] mono">{role.id}</div>
                      </div>
                    </div>
                  </div>
                  {role.description && (
                    <p className="text-[12px] text-[var(--text-dim)] mb-2">{role.description}</p>
                  )}
                  {role.permissions.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {role.permissions.map((perm) => (
                        <Badge key={perm} tone="accent">
                          {perm}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[12px] text-[var(--text-dim)]">No permissions</p>
                  )}
                </Card>
              ))}
            </div>
          )}
        </RequestResult>

        <PermissionGate scope="role:write">
          <Card>
            <div className="font-medium mb-4 flex items-center gap-2">
              <Shield size={16} /> Assign Role
            </div>
            <div className="space-y-3">
              <Field label="User ID">
                <input
                  className="input"
                  placeholder="User ID…"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                />
              </Field>

              <Field label="Role">
                <select
                  className="input"
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                >
                  <option value="">Select role…</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Button
                variant="primary"
                onClick={() => void handleAssign()}
                disabled={!userId.trim() || !selectedRole.trim() || assigning}
                className="w-full justify-center"
              >
                <Send size={13} /> Assign
              </Button>

              {lastResult && (
                <Badge tone={lastResult.ok ? 'good' : 'bad'}>
                  {lastResult.message}
                </Badge>
              )}
            </div>
          </Card>
        </PermissionGate>
      </div>
    </div>
  )
}
