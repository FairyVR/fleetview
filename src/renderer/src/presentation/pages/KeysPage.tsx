import { useState } from 'react'
import { KeyRound, Plus, Trash2, ShieldCheck, Radar, CheckCircle2, Star } from 'lucide-react'
import type { ApiKeyRecord } from '@shared/models'
import { useAppStore } from '../../state/useAppStore'
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

export default function KeysPage() {
  const { keys, activeKeyId, refreshKeys, setActiveKey, secureStorageAvailable, discoverActive } =
    useAppStore()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [owner, setOwner] = useState('')
  const [secret, setSecret] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<Record<string, string>>({})

  async function add() {
    if (!secret.trim()) return
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
            <Button variant="primary" disabled={!secret.trim()} onClick={() => void add()}>
              Add key
            </Button>
          </>
        }
      >
        <div className="grid gap-3">
          <Field label="Name">
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Alpha admin" />
          </Field>
          <Field label="Owner (optional)">
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
