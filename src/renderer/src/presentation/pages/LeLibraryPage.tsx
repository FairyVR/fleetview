import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Star, Copy, Trash2, Search, Download, Upload, Save, History } from 'lucide-react'
import type { LeConfig } from '@shared/models'
import { api } from '../../lib/api'
import { ts } from '../../lib/format'
import { PageHeader, Card, Button, Badge, Field, EmptyState, JsonBlock } from '../components/ui'
import { cn } from '../../lib/cn'
import { normalizeLeCode } from '../../lib/leFormat'

const BLANK: Omit<LeConfig, 'id' | 'createdAt' | 'modifiedAt' | 'history'> = {
  name: '',
  description: '',
  author: '',
  category: '',
  code: '',
  tags: [],
  notes: '',
  favorite: false
}

export default function LeLibraryPage() {
  const [configs, setConfigs] = useState<LeConfig[]>([])
  const [query, setQuery] = useState('')
  const [favOnly, setFavOnly] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Partial<LeConfig>>(BLANK)
  // Raw text for the tags input — parsing on every keystroke would eat separator commas.
  const [tagsText, setTagsText] = useState('')
  const parseTags = (s: string) => s.split(',').map((t) => t.trim()).filter(Boolean)
  const [showHistory, setShowHistory] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  async function refresh() {
    setConfigs(await api.listLeConfigs())
  }
  useEffect(() => {
    void refresh()
  }, [])

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return configs
      .filter((c) => (favOnly ? c.favorite : true))
      .filter(
        (c) =>
          !q ||
          [c.name, c.description, c.author, c.category, ...(c.tags ?? [])]
            .filter(Boolean)
            .some((f) => f!.toLowerCase().includes(q))
      )
  }, [configs, query, favOnly])

  function select(c: LeConfig) {
    setSelectedId(c.id)
    setDraft(c)
    setTagsText((c.tags ?? []).join(', '))
    setShowHistory(false)
  }

  function newConfig() {
    setSelectedId(null)
    setDraft(BLANK)
    setTagsText('')
    setShowHistory(false)
  }

  async function save() {
    if (!draft.name?.trim() || !draft.code?.trim()) return
    const saved = await api.saveLeConfig({
      ...draft,
      id: selectedId ?? undefined,
      name: draft.name,
      code: normalizeLeCode(draft.code),
      tags: parseTags(tagsText)
    } as LeConfig)
    await refresh()
    select(saved)
  }

  async function duplicate(id: string) {
    const dup = await api.duplicateLeConfig(id)
    await refresh()
    if (dup) select(dup)
  }

  async function remove(id: string) {
    await api.deleteLeConfig(id)
    await refresh()
    newConfig()
  }

  async function toggleFav(c: LeConfig) {
    await api.saveLeConfig({ ...c, favorite: !c.favorite })
    await refresh()
    if (c.id === selectedId) setDraft((d) => ({ ...d, favorite: !d.favorite }))
  }

  async function exportAll() {
    const bundle = await api.exportBundle()
    downloadJson(`fleetview-le-library-${Date.now()}.json`, bundle)
  }

  function exportOne(c: LeConfig) {
    // A single-config bundle imports through the same path as a full export.
    const slug = c.name.trim().replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'config'
    downloadJson(`fleetview-le-${slug}.json`, { version: 1, exportedAt: Date.now(), leConfigs: [c], presets: [] })
  }

  function importFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const text = String(reader.result)
        const parsed = JSON.parse(text)
        // Accept either a full bundle or a single config's raw code paste.
        if (parsed.version === 1 && Array.isArray(parsed.leConfigs)) {
          await api.importBundle(parsed)
        } else {
          await api.saveLeConfig({ name: file.name.replace(/\.[^.]+$/, ''), code: text })
        }
        await refresh()
      } catch {
        // Treat as raw LE code text.
        await api.saveLeConfig({ name: file.name.replace(/\.[^.]+$/, ''), code: String(reader.result) })
        await refresh()
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const selected = configs.find((c) => c.id === selectedId)

  return (
    <div>
      <PageHeader
        title="LE Config Library"
        subtitle="A local library of Level Editor configs. Paste codes, import/export, duplicate, version, favorite, categorize, and annotate. Stored on this machine only."
        actions={
          <>
            <input ref={fileInput} type="file" accept=".json,.txt" hidden onChange={importFile} />
            <Button onClick={() => fileInput.current?.click()}><Upload size={14} /> Import</Button>
            <Button onClick={() => void exportAll()}><Download size={14} /> Export all</Button>
            <Button variant="primary" onClick={newConfig}><Plus size={14} /> New</Button>
          </>
        }
      />

      <div className="grid grid-cols-[300px_1fr] gap-4 h-[calc(100vh-190px)]">
        {/* List */}
        <div className="flex flex-col min-h-0">
          <div className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
              <input className="input pl-9" placeholder="Search configs…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <Button variant={favOnly ? 'primary' : 'default'} onClick={() => setFavOnly((v) => !v)}>
              <Star size={14} />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto grid gap-1.5 pr-1">
            {filtered.length === 0 && <EmptyState title="No configs" hint="Create or import one." />}
            {filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => select(c)}
                className={cn('card px-3 py-2.5 text-left', selectedId === c.id && 'border-[var(--accent-2)]')}
              >
                <div className="flex items-center gap-2">
                  {c.favorite && <Star size={12} className="text-[var(--warn)] fill-[var(--warn)]" />}
                  <span className="font-medium text-[13px] truncate">{c.name}</span>
                </div>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  {c.category && <Badge>{c.category}</Badge>}
                  {c.tags?.slice(0, 2).map((t) => <Badge key={t}>{t}</Badge>)}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Editor */}
        <div className="overflow-y-auto">
          <Card className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Name">
                <input className="input" value={draft.name ?? ''} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </Field>
              <Field label="Author">
                <input className="input" value={draft.author ?? ''} onChange={(e) => setDraft({ ...draft, author: e.target.value })} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Category">
                <input className="input" value={draft.category ?? ''} onChange={(e) => setDraft({ ...draft, category: e.target.value })} />
              </Field>
              <Field label="Tags (comma separated)">
                <input
                  className="input"
                  value={tagsText}
                  onChange={(e) => setTagsText(e.target.value)}
                  onBlur={() => setDraft({ ...draft, tags: parseTags(tagsText) })}
                />
              </Field>
            </div>
            <Field label="Description">
              <input className="input" value={draft.description ?? ''} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </Field>
            <Field label="LE config code">
              <textarea
                className="input mono h-40 resize-y"
                value={draft.code ?? ''}
                onChange={(e) => setDraft({ ...draft, code: e.target.value })}
                placeholder="Paste the raw Level Editor config code here…"
              />
              <div className="mt-1.5">
                <Button
                  variant="ghost"
                  onClick={() => setDraft({ ...draft, code: normalizeLeCode(draft.code ?? '') })}
                  title="Ensure every line ends with a comma except the last"
                >
                  Format commas
                </Button>
              </div>
            </Field>
            <Field label="Notes">
              <textarea className="input h-20 resize-y" value={draft.notes ?? ''} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
            </Field>

            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="primary" disabled={!draft.name?.trim() || !draft.code?.trim()} onClick={() => void save()}>
                <Save size={14} /> {selectedId ? 'Save' : 'Create'}
              </Button>
              {selected && (
                <>
                  <Button onClick={() => void toggleFav(selected)}>
                    <Star size={14} className={selected.favorite ? 'text-[var(--warn)] fill-[var(--warn)]' : ''} /> Favorite
                  </Button>
                  <Button onClick={() => void duplicate(selected.id)}><Copy size={14} /> Duplicate</Button>
                  <Button onClick={() => exportOne(selected)}><Download size={14} /> Export</Button>
                  <Button onClick={() => setShowHistory((v) => !v)}>
                    <History size={14} /> Versions ({selected.history.length})
                  </Button>
                  <Button variant="danger" onClick={() => void remove(selected.id)}><Trash2 size={14} /> Delete</Button>
                  <span className="ml-auto text-[11px] text-[var(--text-faint)]">
                    modified {ts(selected.modifiedAt, false)}
                  </span>
                </>
              )}
            </div>

            {showHistory && selected && (
              <div className="grid gap-2">
                <div className="label">Version history (newest last)</div>
                {selected.history.length === 0 && <div className="text-[12px] text-[var(--text-faint)]">No prior versions yet — versions are snapshotted when you save changes to the code.</div>}
                {selected.history.map((v, i) => (
                  <div key={i} className="grid gap-1">
                    <div className="text-[11px] text-[var(--text-faint)]">{ts(v.createdAt)}</div>
                    <JsonBlock value={v.code} className="max-h-32" />
                    <Button className="w-fit" onClick={() => setDraft((d) => ({ ...d, code: v.code }))}>Restore this version</Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}

function downloadJson(name: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}
