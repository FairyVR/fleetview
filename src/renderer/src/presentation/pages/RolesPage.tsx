import { useRef, useState } from 'react'
import { Shield, RefreshCw, Send, Users, Trash2 } from 'lucide-react'
import { api } from '../../lib/api'
import { useEndpoint } from '../../services/useEndpoint'
import { PageHeader, Card, Button, Badge, Field, EmptyState } from '../components/ui'
import { RequestResult } from '../components/RequestResult'
import { PermissionGate } from '../components/PermissionGate'
import { FleetScoped } from '../components/FleetScoped'
import { Modal } from '../components/Modal'
import { useAppStore } from '../../state/useAppStore'
import { loadFleetUsers, loadRoleMembers, type FleetUser } from '../../lib/fleetUsers'

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
      <PageHeader title="Roles" subtitle="Fleet roles: click one to see its members, or assign it to players by name." />
      <FleetScoped>{(fleetId) => <RolesEditor fleetId={fleetId} />}</FleetScoped>
    </div>
  )
}

function RolesEditor({ fleetId }: { fleetId: string }) {
  const { data, response, loading, run } = useEndpoint<unknown>('roles.list', {
    params: { fleetId },
    auto: true
  })
  const showIds = useAppStore((s) => s.settings?.showIds ?? false)
  const [names, setNames] = useState('')
  const [selectedRole, setSelectedRole] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [assignResults, setAssignResults] = useState<Array<{ name: string; ok: boolean; msg?: string }> | null>(null)
  const [memberRole, setMemberRole] = useState<Role | null>(null)
  const [members, setMembers] = useState<FleetUser[] | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [removing, setRemoving] = useState(false)
  const [removeError, setRemoveError] = useState<string | null>(null)
  // Guards the members load so a slower response for a previously-opened role can't
  // overwrite the currently-open one — and so a rejection can't strand "Loading…".
  const activeRoleRef = useRef<string | null>(null)

  const roles = asRoles(data)

  async function openMembers(role: Role) {
    activeRoleRef.current = role.id
    setMemberRole(role)
    setMembers(null)
    setSelected(new Set())
    setRemoveError(null)
    try {
      const loaded = await loadRoleMembers(fleetId, role.id)
      if (activeRoleRef.current === role.id) setMembers(loaded)
    } catch {
      if (activeRoleRef.current === role.id) {
        setMembers([])
        setRemoveError('Could not load members for this role.')
      }
    }
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function removeRoleFrom(userIds: string[]) {
    if (!memberRole || !userIds.length) return
    setRemoving(true)
    setRemoveError(null)
    const removed: string[] = []
    const failed: string[] = []
    for (const userId of userIds) {
      const res = await api.request({
        endpointId: 'roles.unassign',
        params: { fleetId, userId, roleId: memberRole.id }
      })
      if (res.ok) removed.push(userId)
      else failed.push(members?.find((m) => m.id === userId)?.name ?? userId)
    }
    setMembers((prev) => prev?.filter((m) => !removed.includes(m.id)) ?? null)
    setSelected(new Set())
    if (failed.length) setRemoveError(`Failed to remove role from: ${failed.join(', ')}`)
    setRemoving(false)
  }

  async function handleAssign() {
    const wanted = names.split(',').map((n) => n.trim()).filter(Boolean)
    if (!wanted.length || !selectedRole) return
    setAssigning(true)
    setAssignResults(null)
    try {
      const users = await loadFleetUsers(fleetId)
      const byName = new Map(users.map((u) => [u.name.toLowerCase(), u]))
      const results: Array<{ name: string; ok: boolean; msg?: string }> = []
      for (const name of wanted) {
        const user = byName.get(name.toLowerCase())
        if (!user) {
          results.push({ name, ok: false, msg: 'no player with that name in this fleet' })
          continue
        }
        const res = await api.request({
          endpointId: 'roles.assign',
          params: { fleetId, userId: user.id, roleId: selectedRole }
        })
        results.push({ name, ok: res.ok, msg: res.ok ? undefined : res.error?.message ?? `HTTP ${res.status}` })
      }
      setAssignResults(results)
      if (results.every((r) => r.ok)) setNames('')
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
                <button
                  key={role.id}
                  onClick={() => void openMembers(role)}
                  className="card p-4 text-left w-full hover:border-[var(--accent-2)] transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Shield size={16} className="text-[var(--accent)]" />
                      <div>
                        <div className="font-medium">{role.name}</div>
                        {showIds && <div className="text-[11px] text-[var(--text-faint)] mono">{role.id}</div>}
                      </div>
                    </div>
                    <Badge><Users size={10} /> members</Badge>
                  </div>
                  {role.description && (
                    <p className="text-[12px] text-[var(--text-dim)] mb-2">{role.description}</p>
                  )}
                  {role.permissions.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {role.permissions.map((perm) => (
                        <Badge key={perm} tone="accent">{perm}</Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[12px] text-[var(--text-dim)]">No permissions</p>
                  )}
                </button>
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
              <Field label="Player names (comma-separated)">
                <textarea
                  className="input text-[12px]"
                  rows={3}
                  placeholder="Fairy-, Dozy_daisy, lI.bread.lI"
                  value={names}
                  onChange={(e) => setNames(e.target.value)}
                />
              </Field>

              <Field label="Role">
                <select className="input" value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)}>
                  <option value="">Select role…</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                  ))}
                </select>
              </Field>

              <Button
                variant="primary"
                onClick={() => void handleAssign()}
                disabled={!names.trim() || !selectedRole || assigning}
                className="w-full justify-center"
              >
                <Send size={13} /> {assigning ? 'Assigning…' : 'Assign to all listed'}
              </Button>

              {assignResults && (
                <div className="grid gap-1">
                  {assignResults.map((r) => (
                    <div key={r.name} className="flex items-center gap-2 text-[12px]">
                      <Badge tone={r.ok ? 'good' : 'bad'}>{r.ok ? 'ok' : 'failed'}</Badge>
                      <span>{r.name}</span>
                      {r.msg && <span className="text-[var(--text-dim)]">{r.msg}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </PermissionGate>
      </div>

      <Modal
        open={memberRole !== null}
        title={memberRole ? `${memberRole.name} — members` : 'Members'}
        onClose={() => setMemberRole(null)}
        footer={<Button onClick={() => setMemberRole(null)}>Close</Button>}
      >
        {members === null ? (
          <p className="text-[13px] text-[var(--text-dim)]">Loading members…</p>
        ) : members.length === 0 ? (
          <EmptyState
            title="No members found"
            hint="No player in this fleet's user list currently reports this role."
          />
        ) : (
          <div className="space-y-3">
            <PermissionGate scope="role:write">
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-[var(--border-soft)]">
                <label className="flex items-center gap-2 text-[12px] text-[var(--text-dim)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selected.size === members.length && members.length > 0}
                    onChange={(e) =>
                      setSelected(e.target.checked ? new Set(members.map((m) => m.id)) : new Set())
                    }
                  />
                  Select all
                </label>
                <Button
                  variant="danger"
                  disabled={selected.size === 0 || removing}
                  onClick={() => void removeRoleFrom([...selected])}
                >
                  <Trash2 size={13} /> {removing ? 'Removing…' : `Remove role (${selected.size})`}
                </Button>
              </div>
            </PermissionGate>

            {removeError && <p className="text-[12px] text-[var(--bad)]">{removeError}</p>}

            <div className="grid gap-1.5">
              {members.map((m) => (
                <div key={m.id} className="flex items-center gap-2 text-[13px]">
                  <PermissionGate scope="role:write" hideWhenDenied>
                    <input
                      type="checkbox"
                      checked={selected.has(m.id)}
                      onChange={() => toggleSelected(m.id)}
                    />
                  </PermissionGate>
                  <Users size={13} className="text-[var(--accent)]" />
                  <span>{m.name}</span>
                  {showIds && <span className="mono text-[11px] text-[var(--text-faint)]">{m.id}</span>}
                  <PermissionGate scope="role:write" hideWhenDenied>
                    <Button
                      variant="ghost"
                      className="ml-auto"
                      disabled={removing}
                      onClick={() => void removeRoleFrom([m.id])}
                      aria-label={`Remove role from ${m.name}`}
                    >
                      <Trash2 size={13} />
                    </Button>
                  </PermissionGate>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
