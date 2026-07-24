import { useState } from 'react'
import { Save } from 'lucide-react'
import { normalizeBaseUrl } from '@shared/registry'
import { THEMES, type ThemeId } from '@shared/ipc'
import { useAppStore } from '../../state/useAppStore'
import { PageHeader, Card, Button, Field, Badge } from '../components/ui'

export default function SettingsPage() {
  const { settings, updateSettings } = useAppStore()
  const [draft, setDraft] = useState(settings)
  const [saved, setSaved] = useState(false)
  if (!draft) return null

  const dirty = JSON.stringify(draft) !== JSON.stringify(settings)

  async function save() {
    if (!draft) return
    await updateSettings(draft)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Settings"
        subtitle="Connection and request behavior for the API client."
        actions={
          <Button variant="primary" disabled={!dirty} onClick={() => void save()}>
            <Save size={15} /> {saved ? 'Saved' : 'Save'}
          </Button>
        }
      />

      <Card className="grid gap-4">
        <Field label="API base URL">
          <input
            className="input mono"
            value={draft.baseUrl}
            onChange={(e) => setDraft({ ...draft, baseUrl: e.target.value })}
            placeholder="https://api.oriondrift.net/v2"
          />
          {normalizeBaseUrl(draft.baseUrl.trim()) !== 'https://api.oriondrift.net' && (
            <span className="text-[12px] text-[var(--warn)] mt-1.5 inline-block">
              The official Orion Drift API host is <code className="mono">https://api.oriondrift.net</code>
              {' '}(verified from the dashboard client). Requests will fail against anything else.
            </span>
          )}
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Request timeout (ms)">
            <input
              className="input"
              type="number"
              value={draft.requestTimeoutMs}
              onChange={(e) => setDraft({ ...draft, requestTimeoutMs: Number(e.target.value) })}
            />
          </Field>
          <Field label="Max retries">
            <input
              className="input"
              type="number"
              value={draft.maxRetries}
              onChange={(e) => setDraft({ ...draft, maxRetries: Number(e.target.value) })}
            />
          </Field>
        </div>

        <Field label="Theme">
          <select
            className="input"
            value={draft.theme}
            onChange={(e) => setDraft({ ...draft, theme: e.target.value as ThemeId })}
          >
            {THEMES.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </Field>

        <label className="flex items-center gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={draft.developerMode}
            onChange={(e) => setDraft({ ...draft, developerMode: e.target.checked })}
          />
          <span className="text-[13px]">Developer mode</span>
          <Badge>verbose logging, raw payloads</Badge>
        </label>

        <label className="flex items-center gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={draft.dangerZone}
            onChange={(e) => setDraft({ ...draft, dangerZone: e.target.checked })}
          />
          <span className="text-[13px]">Danger Zone</span>
          <Badge tone="warn">WIP</Badge>
        </label>

        <label className="flex items-center gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={draft.showIds}
            onChange={(e) => setDraft({ ...draft, showIds: e.target.checked })}
          />
          <span className="text-[13px]">Show internal IDs</span>
          <Badge>fleet, station, and player IDs in lists</Badge>
        </label>
      </Card>
    </div>
  )
}
