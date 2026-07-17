import { useState } from 'react'
import { Shield, RefreshCw, Send } from 'lucide-react'
import type { Role } from '@shared/models'
import { api } from '../../lib/api'
import { useEndpoint } from '../../services/useEndpoint'
import { PageHeader, Card, Button, Badge, Field } from '../components/ui'
import { RequestResult } from '../components/RequestResult'
import { PermissionGate } from '../components/PermissionGate'

function asRoles(data: unknown): Role[] {
  const arr = Array.isArray(data) ? data : (data as { roles?: unknown[] })?.roles ?? []
  return (arr as Record<string, unknown>[]).map((r) => ({
    id: String(r.id ?? r.roleId ?? ''),
    name: String(r.name ?? r.id ?? 'Unknown'),
    permissions: Array.isArray(r.permissions) ? (r.permissions as string[]) : undefined,
    raw: r
  }))
}

export default function RolesPage() {
  const { data, response, loading, run } = useEndpoint<unknown>('roles.list', { auto: true })
  const [playerId, setPlayerId] = useState('')
  const [selectedRole, setSelectedRole] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [lastResult, setLastResult] = useState<{ ok: boolean; message: string } | null>(null)

  const roles = asRoles(data)

  async function handleAssign() {
    if (!playerId.trim() || !selectedRole.trim()) return

    setAssigning(true)
    try {
      const res = await api.request({
        endpointId: 'roles.assign',
        params: { playerId },
        body: { roleId: selectedRole }
      })
      setLastResult({
        ok: res.ok,
        message: res.ok ? `Role assigned to ${playerId}` : 'Failed to assign role'
      })
      if (res.ok) {
        setPlayerId('')
        setSelectedRole('')
      }
      setTimeout(() => setLastResult(null), 2000)
    } finally {
      setAssigning(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Roles"
        subtitle="Manage user roles and permissions."
        actions={<Button onClick={() => void run()}><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh</Button>}
      />

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
                  {role.permissions && role.permissions.length > 0 ? (
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

        <PermissionGate scope="role-management">
          <Card>
            <div className="font-medium mb-4 flex items-center gap-2">
              <Shield size={16} /> Assign Role
            </div>
            <div className="space-y-3">
              <Field label="Player ID">
                <input
                  className="input"
                  placeholder="Player ID…"
                  value={playerId}
                  onChange={(e) => setPlayerId(e.target.value)}
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
                disabled={!playerId.trim() || !selectedRole.trim() || assigning}
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
