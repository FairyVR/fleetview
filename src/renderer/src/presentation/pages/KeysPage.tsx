import { useState } from 'react'
import { KeyRound, Plus, Trash2, ShieldCheck, Radar, CheckCircle2, Star } from 'lucide-react'
import type { ApiKeyRecord, FleetProbeResult, PermissionSet } from '@shared/models'
import { useAppStore } from '../../state/useAppStore'
import { useSelectionStore } from '../../state/useSelectionStore'
import { api } from '../../lib/api'
import { ago } from '../../lib/format'
import { PageHeader, Button, Card, Badge, StatusDot, Field, EmptyState } from '../components/ui'
import { Modal } from '../components/Modal'

function tone(h: ApiKeyRecord['health']) {
  if (h === 'valid') return 'good' as const
  if (h === 'invalid' || h === 'expired') return 'bad' as const
  if (h === 'error') return 'warn' as const
  return 'idle' as const
}

/** Badge has no 'idle' tone — map unknown health to 'neutral'. */
function badgeTone(h: ApiKeyRecord['health']) {
  const t = tone(h)
  return t === 'idle' ? ('neutral' as const) : t
}

/** Fleet id→name options from a discovered permission set (names live in the raw fleet list). */
function fleetOptions(perms: PermissionSet): Array<{ id: string; name: string }> {
  const names: Record<string, string> = {}
  const items = (perms.raw as { items?: unknown[] } | null)?.items
  for (const f of Array.isArray(items) ? items : []) {
    const o = f as Record<string, unknown>
    if (typeof o.fleet_id === 'string' && typeof o.fleet_name === 'string') names[o.fleet_id] = o.fleet_name
  }
  return Object.keys(perms.grants ?? {}).map((id) => ({ id, name: names[id] ?? id }))
}

export default function KeysPage() {
  const { keys, activeKeyId, refreshKeys, setActiveKey, secureStorageAvailable, discoverActive } =
    useAppStore()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [owner, setOwner] = useState('')
  const [secret, setSecret] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<Record<string, string>>({})
  const selectFleet = useSelectionStore((s) => s.selectFleet)
  const [verifyKey, setVerifyKey] = useState<string | null>(null)
  const [fleets, setFleets] = useState<Array<{ id: string; name: string }>>([])
  const [selFleet, setSelFleet] = useState('')
  const [testWrite, setTestWrite] = useState(false)
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<FleetProbeResult[] | null>(null)
  const [loadingFleets, setLoadingFleets] = useState(false)
  const [verifyErr, setVerifyErr] = useState<string | null>(null)

  async function openVerify(id: string) {
    setVerifyKey(id)
    setResults(null)
    setTestWrite(false)
    setFleets([])
    setVerifyErr(null)
    setLoadingFleets(true)
    try {
      let perms = await api.getPermissions(id)
      if (!Object.keys(perms.grants ?? {}).length) perms = await api.discoverPermissions(id)
      let opts = fleetOptions(perms)
      if (!opts.length) {
        // Discovery came back empty — ask the API for the fleet list directly.
        const res = await api.request({
          endpointId: 'fleet.list',
          keyId: id,
          params: { include_stations: false, page_size: 32, page: 1 }
        })
        const items = (res.data as { items?: unknown[] } | null)?.items
        opts = (Array.isArray(items) ? items : [])
          .map((f) => f as Record<string, unknown>)
          .filter((f) => typeof f.fleet_id === 'string')
          .map((f) => ({ id: f.fleet_id as string, name: (f.fleet_name as string) ?? (f.fleet_id as string) }))
        if (!res.ok) setVerifyErr(res.error?.message ?? `HTTP ${res.status}`)
        else if (!opts.length) setVerifyErr('The API returned no fleets for this key.')
      }
      setFleets(opts)
      setSelFleet(opts[0]?.id ?? '')
    } catch (e) {
      setVerifyErr(e instanceof Error ? e.message : String(e))
    } finally {
      setLoadingFleets(false)
    }
  }

  async function runVerify() {
    if (!verifyKey || !selFleet) return
    setRunning(true)
    setResults(null)
    const res = await api.verifyFleetAccess(verifyKey, selFleet, testWrite)
    setResults(res)
    await refreshKeys()
    if (verifyKey === activeKeyId) await discoverActive()
    if (res.some((r) => r.ok)) {
      selectFleet(selFleet, fleets.find((f) => f.id === selFleet)?.name)
    }
    setRunning(false)
  }

  async function add() {
    if (!secret.trim() || !owner.trim()) return
    await api.addKey({ name, owner, secret })
    setName('')
    setOwner('')
    setSecret('')
    setAdding(false)
    await refreshKeys()
  }

  async function test(id: string) {
    setBusy(id)
    const res = await api.testKey(id)
    await api.discoverPermissions(id)
    setMsg((m) => ({ ...m, [id]: res.message }))
    await refreshKeys()
    if (id === activeKeyId) await discoverActive()
    setBusy(null)
  }

  async function remove(id: string) {
    await api.removeKey(id)
    await refreshKeys()
  }

  return (
    <div>
      <PageHeader
        title="API Keys"
        subtitle="Add multiple Orion Drift API keys, switch between them instantly, and validate connectivity + permissions. Secrets are encrypted with your OS credential store and never leave the app's secure process."
        actions={
          <Button variant="primary" onClick={() => setAdding(true)}>
            <Plus size={15} /> Add key
          </Button>
        }
      />

      {!secureStorageAvailable && (
        <Card className="mb-4 border-[color-mix(in_srgb,var(--warn)_40%,transparent)]">
          <div className="flex items-center gap-2 text-[13px]">
            <StatusDot status="warn" />
            OS encryption is unavailable on this machine — keys are stored with base64 obfuscation
            only. Install a Secret Service provider (Linux) to enable real encryption.
          </div>
        </Card>
      )}

      {keys.length === 0 ? (
        <Card>
          <EmptyState
            icon={<KeyRound size={22} />}
            title="No API keys yet"
            hint="Paste an Orion Drift API key to get started. You can store several and switch between them."
            action={<Button variant="primary" onClick={() => setAdding(true)}>Add your first key</Button>}
          />
        </Card>
      ) : (
        <div className="grid gap-3">
          {keys.map((k) => (
            <Card key={k.id} className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <StatusDot status={tone(k.health)} />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{k.name}</span>
                      {k.id === activeKeyId && (
                        <Badge tone="accent">
                          <Star size={10} /> active
                        </Badge>
                      )}
                      <Badge tone={badgeTone(k.health)}>{k.health}</Badge>
                    </div>
                    <div className="text-[12px] text-[var(--text-dim)] mt-0.5 mono">
                      {k.maskedHint ?? '••••'} {k.owner ? `· ${k.owner}` : ''}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {k.id !== activeKeyId && (
                    <Button onClick={() => void setActiveKey(k.id)}>
                      <CheckCircle2 size={14} /> Use
                    </Button>
                  )}
                  <Button disabled={busy === k.id} onClick={() => void test(k.id)}>
                    <Radar size={14} /> {busy === k.id ? 'Testing…' : 'Test'}
                  </Button>
                  <Button onClick={() => void openVerify(k.id)}>
                    <ShieldCheck size={14} /> Verify fleet
                  </Button>
                  <Button variant="danger" onClick={() => void remove(k.id)}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[12px]">
                <Meta label="Permissions" value={k.permissionSummary ?? '—'} icon={<ShieldCheck size={12} />} />
                <Meta label="Fleet access" value={k.fleetAccess?.length ? `${k.fleetAccess.length} fleets` : '—'} />
                <Meta label="Last validated" value={ago(k.lastValidatedAt)} />
                <Meta label="Last used" value={ago(k.lastUsedAt)} />
              </div>
              {msg[k.id] && <div className="text-[12px] text-[var(--text-dim)]">{msg[k.id]}</div>}
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={adding}
        title="Add API key"
        onClose={() => setAdding(false)}
        footer={
          <>
            <Button onClick={() => setAdding(false)}>Cancel</Button>
            <Button variant="primary" disabled={!secret.trim() || !owner.trim()} onClick={() => void add()}>
              Add key
            </Button>
          </>
        }
      >
        <div className="grid gap-3">
          <Field label="Name">
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Alpha admin" />
          </Field>
          <Field label="Owner">
            <input className="input" value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="who this key belongs to" />
          </Field>
          <Field label="API key secret">
            <input
              className="input mono"
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="paste the key — stored encrypted, never shown again"
            />
          </Field>
          <p className="text-[12px] text-[var(--text-faint)]">
            The secret is encrypted immediately and is never displayed or sent anywhere except as
            the Authorization header on requests you make.
          </p>
        </div>
      </Modal>

      <Modal
        open={verifyKey !== null}
        title="Verify fleet access"
        onClose={() => setVerifyKey(null)}
        footer={
          <>
            <Button onClick={() => setVerifyKey(null)}>Close</Button>
            <Button variant="primary" disabled={running || !selFleet} onClick={() => void runVerify()}>
              {running ? 'Running checks…' : 'Run checks'}
            </Button>
          </>
        }
      >
        <div className="grid gap-3">
          {loadingFleets ? (
            <div className="text-[13px] text-[var(--text-dim)]">Loading fleets this key can see…</div>
          ) : fleets.length === 0 ? (
            <div className="text-[13px] text-[var(--warn,orange)]">
              {verifyErr ?? 'This key can’t see any fleets.'}
            </div>
          ) : (
            <Field label="Fleet">
              <select className="input" value={selFleet} onChange={(e) => setSelFleet(e.target.value)}>
                {fleets.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <label className="flex items-center gap-2 text-[13px]">
            <input type="checkbox" checked={testWrite} onChange={(e) => setTestWrite(e.target.checked)} />
            Also test write access (re-saves the fleet's current config unchanged)
          </label>
          {results && (
            <div className="grid gap-1.5">
              {results.map((r) => (
                <div key={r.scope} className="flex items-center gap-2 text-[13px]">
                  <StatusDot status={r.ok ? 'good' : 'bad'} />
                  <span className="mono">{r.scope}</span>
                  {r.ok ? (
                    <Badge tone="good">confirmed</Badge>
                  ) : (
                    <span className="text-[12px] text-[var(--text-dim)]">{r.message ?? `HTTP ${r.status}`}</span>
                  )}
                </div>
              ))}
              <p className="text-[12px] text-[var(--text-faint)] mt-1">
                Confirmed scopes are saved to this key's grants. A failed probe never blocks an
                action — the server always has the final say.
              </p>
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}

function Meta({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div>
      <div className="text-[var(--text-faint)] flex items-center gap-1">{icon}{label}</div>
      <div className="text-[var(--text)] mt-0.5">{value}</div>
    </div>
  )
}
