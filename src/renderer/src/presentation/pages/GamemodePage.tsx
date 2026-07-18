import { useState, useEffect } from 'react'
import { RefreshCw, Download, Upload, RotateCcw, Sparkles, Save } from 'lucide-react'
import { api } from '../../lib/api'
import { useEndpoint } from '../../services/useEndpoint'
import { PageHeader, Card, Button, Badge } from '../components/ui'
import { RequestResult } from '../components/RequestResult'
import { StationScoped } from '../components/StationScoped'
import { PermissionGate } from '../components/PermissionGate'

const SAMPLE_TEMPLATE: Record<string, unknown> = {
  roundTime: 300,
  maxPlayers: 16,
  friendlyFire: false
}

export default function GamemodePage() {
  return (
    <div>
      <PageHeader
        title="Configuration Manager"
        subtitle="Edit station configuration including gamemode overrides and arena keys. All config keys are stored in the station config."
      />
      <StationScoped>{(stationId) => <ConfigEditor stationId={stationId} />}</StationScoped>
    </div>
  )
}

function ConfigEditor({ stationId }: { stationId: string }) {
  const { response, loading, run } = useEndpoint<unknown>('station.config.get', {
    params: { stationId },
    auto: true
  })
  const [edited, setEdited] = useState<Record<string, unknown>>({})
  const [original, setOriginal] = useState<Record<string, unknown>>({})
  const [saving, setSaving] = useState(false)
  const [lastSave, setLastSave] = useState('')

  useEffect(() => {
    if (response?.data) {
      const cfg = (response.data as { config?: unknown } | null)?.config ?? response.data
      const parsed = typeof cfg === 'object' && cfg !== null ? (cfg as Record<string, unknown>) : {}
      setOriginal(parsed)
      setEdited(parsed)
    }
  }, [response?.data])

  function setValue(key: string, value: unknown) {
    setEdited((e) => ({
      ...e,
      [key]: value
    }))
  }

  function deleteKey(key: string) {
    setEdited((e) => {
      const next = { ...e }
      delete next[key]
      return next
    })
  }

  async function saveConfig() {
    if (JSON.stringify(edited) === JSON.stringify(original)) return
    setSaving(true)
    try {
      const res = await api.request({
        endpointId: 'station.config.set',
        params: { stationId },
        body: { config: edited }
      })
      if (res.ok) {
        setLastSave('config')
        setTimeout(() => setLastSave(''), 1500)
        setOriginal(edited)
      }
    } finally {
      setSaving(false)
    }
  }

  async function resetConfig() {
    const res = await api.request({
      endpointId: 'station.config.delete',
      params: { stationId }
    })
    if (res.ok) {
      setOriginal({})
      setEdited({})
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
            const data = JSON.parse(evt.target?.result as string) as Record<string, unknown>
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
    a.download = `config-${stationId}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function loadTemplate() {
    setEdited((e) => ({ ...e, ...SAMPLE_TEMPLATE }))
  }

  const isDirty = JSON.stringify(edited) !== JSON.stringify(original)

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
          onClick={loadTemplate}
          title="Load sample template"
        >
          <Sparkles size={14} /> Template
        </Button>
        {isDirty && <Badge tone="warn">unsaved changes</Badge>}
        {lastSave && <Badge tone="good">saved</Badge>}
      </div>

      <RequestResult response={response} loading={loading} onRetry={() => void run()}>
        {() => (
          <div className="space-y-4">
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="border-b border-[var(--border-soft)]">
                      <th className="text-left py-2 px-3">Key</th>
                      <th className="text-left py-2 px-3">Value</th>
                      <th className="text-left py-2 px-3">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(edited).map(([key, value]) => {
                      const strValue = String(value)
                      return (
                        <tr key={key} className="border-b border-[var(--border-soft)]">
                          <td className="py-2 px-3 mono text-[11px]">{key}</td>
                          <td className="py-2 px-3">
                            <input
                              className="input text-[11px] w-full"
                              value={strValue}
                              onChange={(e) => setValue(key, e.target.value)}
                            />
                          </td>
                          <td className="py-2 px-3">
                            <Button
                              variant="ghost"
                              onClick={() => deleteKey(key)}
                            >
                              Remove
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card className="p-4">
              <div className="space-y-2">
                <div className="text-[12px] font-medium">Add new config key</div>
                <div className="flex gap-2">
                  <input
                    id="new-key-input"
                    className="input flex-1 text-[12px]"
                    placeholder="Key name…"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const input = e.target as HTMLInputElement
                        if (input.value.trim()) {
                          setValue(input.value.trim(), '')
                          input.value = ''
                        }
                      }
                    }}
                  />
                  <Button
                    variant="ghost"
                    onClick={() => {
                      const input = document.getElementById('new-key-input') as HTMLInputElement
                      if (input?.value.trim()) {
                        setValue(input.value.trim(), '')
                        input.value = ''
                      }
                    }}
                  >
                    Add
                  </Button>
                </div>
              </div>
            </Card>

            <div className="flex gap-2">
              <PermissionGate scope="station_config:write">
                <Button
                  variant="primary"
                  onClick={() => void saveConfig()}
                  disabled={!isDirty || saving}
                >
                  <Save size={13} /> Save Config
                </Button>
              </PermissionGate>
              <PermissionGate scope="station_config:write">
                <Button
                  variant="danger"
                  onClick={() => void resetConfig()}
                >
                  <RotateCcw size={13} /> Reset All
                </Button>
              </PermissionGate>
            </div>
          </div>
        )}
      </RequestResult>
    </div>
  )
}
