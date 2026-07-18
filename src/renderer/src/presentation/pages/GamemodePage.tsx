import { useState } from 'react'
import { RefreshCw, Download, Upload, RotateCcw, Sparkles, Save, Copy } from 'lucide-react'
import type { Gamemode } from '@shared/models'
import { api } from '../../lib/api'
import { useEndpoint } from '../../services/useEndpoint'
import { PageHeader, Card, Button, Badge } from '../components/ui'
import { RequestResult } from '../components/RequestResult'
import { StationScoped } from '../components/StationScoped'
import { PermissionGate } from '../components/PermissionGate'

const SAMPLE_TEMPLATE: Record<string, Record<string, unknown>> = {
  competitive: {
    roundTime: 300,
    maxPlayers: 16,
    friendlyFire: false
  },
  casual: {
    roundTime: 600,
    maxPlayers: 32,
    friendlyFire: true
  }
}

function asGamemodes(data: unknown): Gamemode[] {
  const arr = Array.isArray(data) ? data : (data as { gamemodes?: unknown[] })?.gamemodes ?? []
  return (arr as Record<string, unknown>[]).map((g) => ({
    key: String(g.key ?? g.id ?? ''),
    name: String(g.name ?? g.key ?? 'Unknown'),
    arenaKey: g.arenaKey as string | undefined,
    overrides: (g.overrides as Record<string, { current: unknown; default: unknown }> | undefined) ?? {},
    raw: g
  }))
}

export default function GamemodePage() {
  return (
    <div>
      <PageHeader
        title="Gamemode Manager"
        subtitle="Configure gamemode overrides and templates per station."
      />
      <StationScoped>{(stationId) => <GamemodeEditor stationId={stationId} />}</StationScoped>
    </div>
  )
}

function GamemodeEditor({ stationId }: { stationId: string }) {
  const { response, loading, run } = useEndpoint<unknown>('gamemode.list', {
    params: { stationId },
    auto: true
  })
  const [edited, setEdited] = useState<Record<string, Record<string, unknown>>>({})
  const [saving, setSaving] = useState(false)
  const [lastSave, setLastSave] = useState('')

  function setOverride(key: string, field: string, value: unknown) {
    setEdited((e) => ({
      ...e,
      [key]: {
        ...e[key],
        [field]: value
      }
    }))
  }

  async function saveGamemode(gamemode: Gamemode) {
    const currentOverrides = edited[gamemode.key] ?? {}
    setSaving(true)
    try {
      const res = await api.request({
        endpointId: 'gamemode.setOverrides',
        params: { stationId, gamemodeKey: gamemode.key },
        body: { overrides: currentOverrides }
      })
      if (res.ok) {
        setLastSave(gamemode.key)
        setTimeout(() => setLastSave(''), 1500)
        setEdited((e) => {
          const next = { ...e }
          delete next[gamemode.key]
          return next
        })
      }
    } finally {
      setSaving(false)
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
            const data = JSON.parse(evt.target?.result as string) as Record<string, Record<string, unknown>>
            setEdited(data)
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
    a.download = `gamemodes-${stationId}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function loadTemplate(name: string) {
    const template = SAMPLE_TEMPLATE[name]
    if (template) {
      setEdited((e) => ({ ...e, ...(template as Record<string, Record<string, unknown>>) }))
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <Button onClick={() => void run()} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Reload
        </Button>
        <Button variant="ghost" onClick={importJson}>
          <Upload size={14} /> Import
        </Button>
        <Button variant="ghost" onClick={exportJson}>
          <Download size={14} /> Export
        </Button>
        <Button
          variant="ghost"
          onClick={() => loadTemplate('competitive')}
          title="Load competitive template"
        >
          <Sparkles size={14} /> Templates
        </Button>
      </div>

      <RequestResult response={response} loading={loading} onRetry={() => void run()}>
        {(raw) => {
          const modes = asGamemodes(raw)
          return (
            <div className="grid grid-cols-1 gap-4">
              {modes.map((gamemode) => {
                const isDirty = !!edited[gamemode.key]
                const currentEdits = edited[gamemode.key] ?? {}
                return (
                  <Card key={gamemode.key} className={isDirty ? 'border-[var(--accent-2)]' : ''}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div>
                          <div className="font-medium">{gamemode.name}</div>
                          <div className="text-[11px] text-[var(--text-faint)] mono">{gamemode.key}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {gamemode.arenaKey && <Badge>{gamemode.arenaKey}</Badge>}
                        {isDirty && <Badge tone="warn">edited</Badge>}
                        {lastSave === gamemode.key && <Badge tone="good">saved</Badge>}
                      </div>
                    </div>

                    {Object.entries(gamemode.overrides ?? {}).length > 0 ? (
                      <div className="overflow-x-auto mb-3">
                        <table className="w-full text-[12px]">
                          <thead>
                            <tr className="border-b border-[var(--border-soft)]">
                              <th className="text-left py-1.5 px-2">Parameter</th>
                              <th className="text-left py-1.5 px-2">Default</th>
                              <th className="text-left py-1.5 px-2">Current</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(gamemode.overrides ?? {}).map(([param, { default: def, current }]) => (
                              <tr key={param} className="border-b border-[var(--border-soft)]">
                                <td className="py-1.5 px-2 mono">{param}</td>
                                <td className="py-1.5 px-2">{String(def ?? '—')}</td>
                                <td className="py-1.5 px-2">
                                  <input
                                    className="input text-[11px] w-24"
                                    value={String(currentEdits[param] ?? current ?? '')}
                                    onChange={(e) => setOverride(gamemode.key, param, e.target.value)}
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-[12px] text-[var(--text-dim)] mb-3">No overrides available</p>
                    )}

                    <div className="flex gap-2">
                      <Button variant="ghost" onClick={() => setOverride(gamemode.key, 'reset', true)}>
                        <RotateCcw size={13} /> Reset
                      </Button>
                      <Button variant="ghost" onClick={() => setEdited((e) => ({ ...e, [gamemode.key]: {} }))}>
                        <Copy size={13} /> Duplicate
                      </Button>
                      <PermissionGate scope="station_config:write">
                        <Button
                          variant="primary"
                          onClick={() => void saveGamemode(gamemode)}
                          disabled={!isDirty || saving}
                        >
                          <Save size={13} /> Save
                        </Button>
                      </PermissionGate>
                    </div>
                  </Card>
                )
              })}
            </div>
          )
        }}
      </RequestResult>
    </div>
  )
}
