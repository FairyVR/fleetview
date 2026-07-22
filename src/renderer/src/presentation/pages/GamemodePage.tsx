import { useState, useEffect, useMemo, type ReactNode } from 'react'
import { RefreshCw, Download, Upload, RotateCcw, Save, Gamepad2, SlidersHorizontal, Shield, Users } from 'lucide-react'
import { api } from '../../lib/api'
import { useEndpoint } from '../../services/useEndpoint'
import { useSelectionStore } from '../../state/useSelectionStore'
import { loadFleetUsers, loadFleetRoles, loadRoleMembers, type FleetUser, type FleetRole } from '../../lib/fleetUsers'
import { PageHeader, Card, Button, Badge } from '../components/ui'
import { RequestResult } from '../components/RequestResult'
import { StationScoped } from '../components/StationScoped'
import { PermissionGate } from '../components/PermissionGate'
import { Modal } from '../components/Modal'
import {
  classifyKey,
  PINNED_KEYS,
  coerceValue,
  gamemodeKey,
  configDiff,
  CONFIG_WRITE_PARAMS,
  DEFAULT_GM_FIELDS,
  gamemodeFieldDefault
} from '../../lib/stationConfig'
import { GAMEMODE_GROUPS, gamemodeDisplayName, gamemodeGroup, normalizeGamemodeId } from '../../lib/gamemodes'

export default function GamemodePage() {
  return (
    <div>
      <PageHeader
        title="Gamemode Manager"
        subtitle="Station configuration and per-arena gamemode overrides. Select multiple arenas to edit them together."
      />
      <StationScoped>{(stationId) => <ConfigEditor stationId={stationId} />}</StationScoped>
    </div>
  )
}

/** Sort arenas by their tag, in GAMEMODE_GROUPS order; ungrouped extras go last. */
const GROUP_ORDER = Object.keys(GAMEMODE_GROUPS)
function groupRank(group: string | null): number {
  const i = group ? GROUP_ORDER.indexOf(group) : -1
  return i === -1 ? GROUP_ORDER.length : i
}

/** Label + value row — input hugs the label instead of stretching to the card edge. */
function Row({ label, breakAll, children }: { label: string; breakAll?: boolean; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`mono text-[11px] text-[var(--text-dim)] min-w-[180px] ${breakAll ? 'break-all' : ''}`}>
        {label}
      </span>
      <div className="flex-1 max-w-[220px]">{children}</div>
    </div>
  )
}

/** Segmented true/false toggle — the chosen side is highlighted; neither when unset. */
function BoolToggle({ value, onChange }: { value?: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="grid grid-cols-2 rounded-lg border border-[var(--border)] overflow-hidden text-[12px]">
      {[true, false].map((v) => (
        <button
          key={String(v)}
          type="button"
          onClick={() => onChange(v)}
          className={
            value === v
              ? 'py-1.5 font-semibold text-white bg-[var(--accent-2)]'
              : 'py-1.5 text-[var(--text-dim)] bg-[var(--bg-elev-2)] hover:text-[var(--text)] transition-colors'
          }
        >
          {String(v)}
        </button>
      ))}
    </div>
  )
}

/** One typed input matched to the value's type: booleans get a selector, never a text field. */
function ValueInput({
  value,
  onChange
}: {
  value: unknown
  onChange: (v: unknown) => void
}) {
  if (typeof value === 'boolean') {
    return <BoolToggle value={value} onChange={onChange} />
  }
  if (typeof value === 'number') {
    return (
      <input
        className="input text-[12px] w-full"
        type="number"
        step="any"
        value={value}
        onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
      />
    )
  }
  return (
    <input className="input text-[12px] w-full" value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />
  )
}

/** Split/join the whitelist string as a de-duped (case-insensitive) list of usernames. */
function parseWhitelist(value: string): string[] {
  return value.split(',').map((n) => n.trim()).filter(Boolean)
}

/**
 * Whitelist editor: a raw comma-separated username list plus a search that adds a single
 * user, or expands a whole role to its members' usernames (snapshot at edit time).
 */
function WhitelistPicker({
  value,
  onChange,
  users,
  roles,
  fleetId
}: {
  value: string
  onChange: (v: string) => void
  users: FleetUser[]
  roles: FleetRole[]
  fleetId: string
}) {
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const names = parseWhitelist(value)

  const addNames = (toAdd: string[]) => {
    const merged = [...names]
    for (const n of toAdd)
      if (n && !merged.some((m) => m.toLowerCase() === n.toLowerCase())) merged.push(n)
    onChange(merged.join(', '))
  }

  const q = query.trim().toLowerCase()
  const roleHits = q ? roles.filter((r) => r.name.toLowerCase().includes(q)).slice(0, 4) : []
  const userHits = q ? users.filter((u) => u.name.toLowerCase().includes(q)).slice(0, 6) : []

  async function addRole(role: FleetRole) {
    setBusy(true)
    try {
      const members = await loadRoleMembers(fleetId, role.id)
      addNames(members.map((m) => m.name))
    } finally {
      setBusy(false)
      setQuery('')
    }
  }

  return (
    <div className="grid gap-1.5">
      <textarea
        className="input text-[12px]"
        rows={2}
        placeholder="Allowlisted users (comma-separated)"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="relative">
        <input
          className="input text-[12px] w-full"
          placeholder="Search users or roles…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {q && (roleHits.length > 0 || userHits.length > 0) && (
          <div className="absolute z-10 mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-elev-2)] shadow-lg max-h-56 overflow-auto">
            {roleHits.map((r) => (
              <button
                key={`r-${r.id}`}
                type="button"
                disabled={busy}
                onClick={() => void addRole(r)}
                className="flex items-center gap-2 w-full text-left px-2 py-1.5 text-[12px] hover:bg-[var(--bg-elev-1)] disabled:opacity-50"
              >
                <Shield size={12} className="text-[var(--accent)]" />
                <span className="flex-1">{r.name}</span>
                <Badge tone="accent">role</Badge>
              </button>
            ))}
            {userHits.map((u) => (
              <button
                key={`u-${u.id}`}
                type="button"
                onClick={() => {
                  addNames([u.name])
                  setQuery('')
                }}
                className="flex items-center gap-2 w-full text-left px-2 py-1.5 text-[12px] hover:bg-[var(--bg-elev-1)]"
              >
                <Users size={12} className="text-[var(--text-dim)]" />
                <span className="flex-1">{u.name}</span>
                {names.some((n) => n.toLowerCase() === u.name.toLowerCase()) && <Badge tone="good">added</Badge>}
              </button>
            ))}
          </div>
        )}
      </div>
      {busy && <span className="text-[11px] text-[var(--text-dim)]">Adding role members…</span>}
    </div>
  )
}

interface GmEntry {
  /** Original-cased id as it appears in config keys (writes must preserve it). */
  id: string
  display: string
  group: string | null
  /** field (lowercased) -> exact config key */
  fields: Record<string, string>
}

function ConfigEditor({ stationId }: { stationId: string }) {
  const { response, loading, run } = useEndpoint<unknown>('station.config.get', {
    params: { stationId },
    auto: true
  })
  const [edited, setEdited] = useState<Record<string, unknown>>({})
  const [original, setOriginal] = useState<Record<string, unknown>>({})
  const [selectedGms, setSelectedGms] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [lastSave, setLastSave] = useState('')
  const [saveError, setSaveError] = useState('')
  const [confirmReset, setConfirmReset] = useState(false)
  const [resetting, setResetting] = useState(false)

  // Fleet users + roles power the whitelist picker; loaded once per fleet.
  const fleetId = useSelectionStore((s) => s.fleetId)
  const [wlUsers, setWlUsers] = useState<FleetUser[]>([])
  const [wlRoles, setWlRoles] = useState<FleetRole[]>([])
  useEffect(() => {
    if (!fleetId) return
    void loadFleetUsers(fleetId).then(setWlUsers).catch(() => {})
    void loadFleetRoles(fleetId).then(setWlRoles).catch(() => {})
  }, [fleetId])

  useEffect(() => {
    if (response?.data) {
      const cfg = (response.data as { config?: unknown } | null)?.config ?? response.data
      const parsed = typeof cfg === 'object' && cfg !== null ? (cfg as Record<string, unknown>) : {}
      setOriginal(parsed)
      setEdited(parsed)
    }
  }, [response?.data])

  const setValue = (key: string, value: unknown) => setEdited((e) => ({ ...e, [key]: value }))

  // ---- classification ----
  const configRows = useMemo(() => {
    const rows = Object.keys(edited).filter((k) => classifyKey(k).kind === 'config')
    // Pinned keys surface even when absent so operators always see them.
    for (const p of PINNED_KEYS) if (!rows.includes(p.key)) rows.push(p.key)
    return rows.sort()
  }, [edited])

  const gamemodes = useMemo(() => {
    const map = new Map<string, GmEntry>()
    // Every fleet ships these arenas by default — always list them, overrides or not.
    for (const [group, ids] of Object.entries(GAMEMODE_GROUPS))
      for (const [id, display] of Object.entries(ids))
        map.set(normalizeGamemodeId(id), { id, display, group, fields: {} })
    for (const key of Object.keys(edited)) {
      const c = classifyKey(key)
      if (c.kind !== 'gamemode') continue
      const lower = normalizeGamemodeId(c.gm)
      const entry =
        map.get(lower) ??
        ({ id: c.gm, display: gamemodeDisplayName(c.gm), group: gamemodeGroup(c.gm), fields: {} } as GmEntry)
      entry.id = c.gm // live config casing wins so new writes match existing keys
      entry.fields[c.field.toLowerCase()] = key
      map.set(lower, entry)
    }
    return map
  }, [edited])

  const selected = [...selectedGms].filter((g) => gamemodes.has(g))
  /** Union of override fields across the selected arenas plus every known default field. */
  const selectedFields = useMemo(() => {
    const fields = new Set<string>(DEFAULT_GM_FIELDS.map((d) => d.field))
    for (const g of selected) for (const f of Object.keys(gamemodes.get(g)?.fields ?? {})) fields.add(f)
    return [...fields].sort()
  }, [selected, gamemodes])

  /** State of a field across the selection: one shared value, mixed values, or unset everywhere. */
  function fieldState(field: string): { kind: 'unset' } | { kind: 'mixed' } | { kind: 'value'; value: unknown } {
    const values = selected.map((g) => {
      const key = gamemodes.get(g)?.fields[field]
      return key ? edited[key] : undefined
    })
    if (values.every((v) => v === undefined)) {
      // No override on any selected arena — show the arena's known default instead of blank,
      // but only when every arena shares the same default (team sizes differ by family).
      const defs = selected.map((g) => gamemodeFieldDefault(gamemodes.get(g)?.id ?? g, field))
      const def = defs[0]
      if (def !== undefined && defs.every((d) => JSON.stringify(d) === JSON.stringify(def)))
        return { kind: 'value', value: def }
      return { kind: 'unset' }
    }
    const first = values[0]
    return values.every((v) => JSON.stringify(v) === JSON.stringify(first))
      ? { kind: 'value', value: first }
      : { kind: 'mixed' }
  }

  /** Stage a field value onto every selected arena (preserving existing key casing). */
  function setFieldForSelection(field: string, value: unknown) {
    setEdited((e) => {
      const next = { ...e }
      for (const g of selected) {
        const gm = gamemodes.get(g)
        if (!gm) continue
        next[gm.fields[field] ?? gamemodeKey(gm.id, field)] = value
        // A team whitelist only takes effect with its toggle on — flip it when a list is entered.
        const toggle =
          field === 'team0whitelist' ? 'buseteam0whitelist' : field === 'team1whitelist' ? 'buseteam1whitelist' : null
        if (toggle && typeof value === 'string' && value.trim() !== '')
          next[gm.fields[toggle] ?? gamemodeKey(gm.id, toggle)] = true
      }
      return next
    })
  }

  function toggleGm(id: string) {
    setSelectedGms((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  /** Plain click replaces the selection with the group; Ctrl/Cmd+click adds it. */
  function selectGroup(group: string | 'all' | 'none', add = false) {
    if (group === 'none') return setSelectedGms(new Set())
    const ids = [...gamemodes.entries()]
      .filter(([, gm]) => group === 'all' || gm.group === group)
      .map(([lower]) => lower)
    setSelectedGms((s) => new Set(add ? [...s, ...ids] : ids))
  }

  // ---- persistence: POST only changed keys, flat, stringified (the shape the API accepts) ----
  async function saveConfig() {
    const patch = configDiff(original, edited)
    if (!Object.keys(patch).length) return
    setSaving(true)
    setSaveError('')
    try {
      const res = await api.request({
        endpointId: 'station.config.set',
        params: { stationId, ...CONFIG_WRITE_PARAMS },
        body: patch
      })
      if (res.ok) {
        setLastSave('config')
        setTimeout(() => setLastSave(''), 1500)
        setOriginal(edited)
      } else {
        setSaveError(res.error?.message ?? 'Save failed.')
      }
    } finally {
      setSaving(false)
    }
  }

  async function resetConfig() {
    setResetting(true)
    setSaveError('')
    try {
      const res = await api.request({ endpointId: 'station.config.delete', params: { stationId } })
      if (res.ok) {
        setOriginal({})
        setEdited({})
        setConfirmReset(false)
      } else {
        setSaveError(res.error?.message ?? 'Reset failed.')
      }
    } finally {
      setResetting(false)
    }
  }

  function importJson() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = (evt) => {
          try {
            setEdited(JSON.parse(evt.target?.result as string) as Record<string, unknown>)
          } catch {
            // silently ignore parse errors
          }
        }
        reader.readAsText(file)
      }
    }
    input.click()
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(edited, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `config-${stationId}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const isDirty = JSON.stringify(edited) !== JSON.stringify(original)
  const groupNames = Object.keys(GAMEMODE_GROUPS).filter((g) =>
    [...gamemodes.values()].some((gm) => gm.group === g)
  )

  return (
    <div>
      <div className="sticky top-0 z-30 flex items-center gap-2 mb-4 flex-wrap bg-[var(--bg)] py-3 -my-3 border-b border-[var(--border-soft)]">
        <Button onClick={() => void run()} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Reload
        </Button>
        <Button variant="ghost" onClick={importJson}>
          <Upload size={14} /> Import
        </Button>
        <Button variant="ghost" onClick={exportJson}>
          <Download size={14} /> Export
        </Button>
        {isDirty && <Badge tone="warn">unsaved changes</Badge>}
        {lastSave && <Badge tone="good">saved</Badge>}
        {saveError && <Badge tone="bad">{saveError}</Badge>}
        <div className="flex-1" />
        <PermissionGate scope="station_config:write">
          <Button variant="primary" onClick={() => void saveConfig()} disabled={!isDirty || saving}>
            <Save size={13} /> Save Config
          </Button>
        </PermissionGate>
        <PermissionGate scope="station_config:write" hideWhenDenied>
          <Button variant="danger" onClick={() => setConfirmReset(true)}>
            <RotateCcw size={13} /> Reset All
          </Button>
        </PermissionGate>
      </div>

      <Modal
        open={confirmReset}
        title="Reset entire station config?"
        onClose={() => setConfirmReset(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmReset(false)}>Cancel</Button>
            <Button variant="danger" onClick={() => void resetConfig()} disabled={resetting}>
              <RotateCcw size={13} /> {resetting ? 'Resetting…' : 'Reset all config'}
            </Button>
          </>
        }
      >
        <p className="text-[13px] text-[var(--text-dim)]">
          This deletes <strong>every</strong> config override for this station — board textures,
          gamemode overrides, and all other settings — reverting it to fleet defaults. This cannot
          be undone from here.
        </p>
        {saveError && <p className="text-[12px] text-[var(--bad)] mt-3">{saveError}</p>}
      </Modal>

      <RequestResult response={response} loading={loading} onRetry={() => void run()}>
        {() => (
          <div className="space-y-4">
            {/* ---------- Config editor ---------- */}
            <Card>
              <div className="flex items-center gap-2 mb-5">
                <SlidersHorizontal size={15} className="text-[var(--accent)]" />
                <span className="font-medium text-[13px]">Config editor</span>
                <Badge>station settings</Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-8 gap-y-4">
                {configRows.map((key) => {
                  const pinned = PINNED_KEYS.find((p) => p.key === key)
                  const value = edited[key]
                  const unset = value === undefined
                  return (
                    <Row key={key} label={key} breakAll>
                      {unset && pinned?.type === 'boolean' ? (
                        <BoolToggle onChange={(v) => setValue(key, v)} />
                      ) : unset && pinned?.type === 'number' ? (
                        <input
                          className="input text-[12px]"
                          type="number"
                          step="any"
                          placeholder="not set"
                          onChange={(e) => e.target.value !== '' && setValue(key, Number(e.target.value))}
                        />
                      ) : (
                        <ValueInput value={value} onChange={(v) => setValue(key, v)} />
                      )}
                    </Row>
                  )
                })}
              </div>
            </Card>

            {/* ---------- Gamemode editor ---------- */}
            <Card>
              <div className="flex items-center gap-2 mb-3">
                <Gamepad2 size={15} className="text-[var(--accent)]" />
                <span className="font-medium text-[13px]">Gamemode editor</span>
                <Badge tone="accent">{gamemodes.size} arenas</Badge>
              </div>

              {gamemodes.size === 0 ? (
                <p className="text-[12px] text-[var(--text-dim)]">
                  No gamemode overrides in this station&apos;s config yet.
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {groupNames.map((g) => (
                      <Button
                        key={g}
                        variant="ghost"
                        title="Click to select this category — Ctrl+click to add more categories"
                        onClick={(e) => selectGroup(g, e.ctrlKey || e.metaKey)}
                      >
                        {g}
                      </Button>
                    ))}
                    <Button variant="ghost" onClick={() => selectGroup('all')}>All</Button>
                    <Button variant="ghost" onClick={() => selectGroup('none')}>None</Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-1.5 mb-4">
                    {[...gamemodes.entries()]
                      .sort(
                        (a, b) =>
                          groupRank(a[1].group) - groupRank(b[1].group) ||
                          a[1].display.localeCompare(b[1].display)
                      )
                      .map(([lower, gm]) => (
                        <label
                          key={lower}
                          className={`flex items-center gap-2 text-[12px] rounded-lg px-2 py-1.5 cursor-pointer border ${
                            selectedGms.has(lower)
                              ? 'border-[var(--accent-2)] bg-[var(--bg-elev-2)]'
                              : 'border-transparent hover:bg-[var(--bg-elev-2)]'
                          }`}
                        >
                          <input type="checkbox" checked={selectedGms.has(lower)} onChange={() => toggleGm(lower)} />
                          <span className="flex-1">{gm.display}</span>
                          {gm.group && <Badge>{gm.group}</Badge>}
                        </label>
                      ))}
                  </div>

                  {selected.length === 0 ? (
                    <p className="text-[12px] text-[var(--text-dim)]">
                      Select one or more arenas (or a group) to edit their overrides together.
                    </p>
                  ) : (
                    <div>
                      <div className="text-[12px] text-[var(--text-dim)] mb-1">
                        Editing <b>{selected.length}</b> arena{selected.length === 1 ? '' : 's'} — changes apply to all
                        selected.
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                        {selectedFields.map((field) => {
                        const state = fieldState(field)
                        if (field === 'team0whitelist' || field === 'team1whitelist') {
                          const current =
                            state.kind === 'value' && typeof state.value === 'string' ? state.value : ''
                          return (
                            <div key={field} className="md:col-span-2 xl:col-span-3 grid gap-1.5">
                              <span className="mono text-[11px] text-[var(--text-dim)]">{field}</span>
                              {fleetId ? (
                                <WhitelistPicker
                                  value={current}
                                  onChange={(v) => setFieldForSelection(field, v)}
                                  users={wlUsers}
                                  roles={wlRoles}
                                  fleetId={fleetId}
                                />
                              ) : (
                                <span className="text-[11px] text-[var(--text-dim)]">
                                  Select a fleet to edit whitelists.
                                </span>
                              )}
                            </div>
                          )
                        }
                        const preset = DEFAULT_GM_FIELDS.find((d) => d.field === field)
                        return (
                          <Row key={field} label={field}>
                            {state.kind === 'value' ? (
                              <ValueInput value={state.value} onChange={(v) => setFieldForSelection(field, v)} />
                            ) : state.kind === 'mixed' ? (
                              <input
                                className="input text-[12px]"
                                placeholder="mixed values — type to overwrite all"
                                onBlur={(e) => {
                                  if (e.target.value.trim() !== '') {
                                    setFieldForSelection(field, coerceValue(e.target.value))
                                    e.target.value = ''
                                  }
                                }}
                              />
                            ) : preset?.type === 'boolean' ? (
                              <BoolToggle onChange={(v) => setFieldForSelection(field, v)} />
                            ) : preset?.type === 'number' ? (
                              <input
                                className="input text-[12px]"
                                type="number"
                                step="any"
                                placeholder="not set"
                                onBlur={(e) =>
                                  e.target.value.trim() !== '' && setFieldForSelection(field, Number(e.target.value))
                                }
                              />
                            ) : (
                              <input
                                className="input text-[12px]"
                                placeholder="not set"
                                onBlur={(e) =>
                                  e.target.value.trim() !== '' && setFieldForSelection(field, e.target.value)
                                }
                              />
                            )}
                          </Row>
                        )
                        })}
                      </div>
                      <div className="flex gap-2 mt-2">
                        <input
                          id="new-gm-field"
                          className="input flex-1 text-[12px]"
                          placeholder="add override field, e.g. matchlengthseconds"
                        />
                        <input id="new-gm-value" className="input flex-1 text-[12px]" placeholder="value (true/false/number/text)" />
                        <Button
                          variant="ghost"
                          onClick={() => {
                            const f = document.getElementById('new-gm-field') as HTMLInputElement
                            const v = document.getElementById('new-gm-value') as HTMLInputElement
                            if (f?.value.trim()) {
                              setFieldForSelection(f.value.trim().toLowerCase(), coerceValue(v?.value ?? ''))
                              f.value = ''
                              if (v) v.value = ''
                            }
                          }}
                        >
                          Add to selected
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </Card>
          </div>
        )}
      </RequestResult>
    </div>
  )
}
