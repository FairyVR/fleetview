import { useState } from 'react'
import { GitCompare, RotateCcw, Download, Upload, CheckCircle2, AlertCircle, Save } from 'lucide-react'
import { PageHeader, Card, Button, Badge } from '../components/ui'
import { JsonEditor, JsonDiff, validateJson } from '../components/JsonEditor'
import { prettyJson } from '../../lib/format'
import { api } from '../../lib/api'

const SAMPLE = prettyJson({
  station: { maxPlayers: 8, region: 'us-east' },
  gamemode: { key: 'deathmatch', scoreLimit: 25, timeLimitSec: 600 },
  boards: { BoardTextureUrl0: 'https://…/a.png' }
})

/**
 * Custom + Raw config editor. Full JSON workbench: edit any config object, validate,
 * auto-format, diff against the loaded baseline, roll back, import/export, and save the
 * result as a reusable preset. Wire the load/apply buttons to a station's config endpoint
 * once verified endpoints exist.
 */
export default function ConfigEditorPage() {
  const [baseline, setBaseline] = useState(SAMPLE)
  const [text, setText] = useState(SAMPLE)
  const [showDiff, setShowDiff] = useState(false)

  const error = validateJson(text)
  const dirty = text !== baseline

  function importFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const content = String(reader.result)
      setBaseline(content)
      setText(content)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  function exportFile() {
    const blob = new Blob([text], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `config-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function saveAsPreset() {
    if (error) return
    await api.savePreset({
      kind: 'arena',
      name: `Config ${new Date().toLocaleString()}`,
      data: JSON.parse(text)
    })
  }

  return (
    <div>
      <PageHeader
        title="Config Editor"
        subtitle="Edit any Orion Drift config as JSON with validation, formatting, search/replace, undo/redo, and a diff against the loaded baseline."
        actions={
          <>
            <label className="btn cursor-pointer">
              <Upload size={14} /> Import
              <input type="file" accept=".json" hidden onChange={importFile} />
            </label>
            <Button onClick={exportFile}><Download size={14} /> Export</Button>
            <Button onClick={() => setShowDiff((v) => !v)}><GitCompare size={14} /> {showDiff ? 'Edit' : 'Diff'}</Button>
          </>
        }
      />

      <Card className="grid gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {error ? (
            <Badge tone="bad"><AlertCircle size={11} /> {error}</Badge>
          ) : (
            <Badge tone="good"><CheckCircle2 size={11} /> valid JSON</Badge>
          )}
          {dirty ? <Badge tone="warn">unsaved changes</Badge> : <Badge>no changes</Badge>}
          <div className="ml-auto flex gap-2">
            <Button disabled={!dirty} onClick={() => setText(baseline)}>
              <RotateCcw size={14} /> Rollback
            </Button>
            <Button variant="primary" disabled={!!error} onClick={() => void saveAsPreset()}>
              <Save size={14} /> Save as preset
            </Button>
          </div>
        </div>

        {showDiff ? (
          <JsonDiff original={baseline} modified={text} height={460} />
        ) : (
          <JsonEditor value={text} onChange={setText} height={460} />
        )}
      </Card>
    </div>
  )
}
