import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Plus,
  Star,
  Copy,
  Trash2,
  Search,
  Download,
  Upload,
  Save,
  History,
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  Pencil,
  Check,
  ClipboardCopy
} from 'lucide-react'
import type { LeConfig } from '@shared/models'
import type { Catalog } from '@shared/catalog'
import { api } from '../../lib/api'
import { ts } from '../../lib/format'
import { PageHeader, Card, Button, Badge, Field, EmptyState, JsonBlock } from '../components/ui'
import { cn } from '../../lib/cn'
import { normalizeLeCode } from '../../lib/leFormat'
import {
  buildFolderTree,
  folderPaths,
  renameFolder,
  UNGROUPED,
  type FolderNode
} from '../../lib/leTree'
import { catalogEntryFrom, updateState } from '../../lib/catalog'
import { useAppStore } from '../../state/useAppStore'

const BLANK: Omit<LeConfig, 'id' | 'createdAt' | 'modifiedAt' | 'history'> = {
  name: '',
  description: '',
  author: '',
  category: '',
  code: '',
  tags: [],
  notes: '',
  favorite: false,
  folder: ''
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
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [renaming, setRenaming] = useState<{ path: string; value: string } | null>(null)
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [copied, setCopied] = useState(false)
  /** Holds the entry JSON when the clipboard is unavailable, so it can be selected by hand. */
  const [copyError, setCopyError] = useState<string | null>(null)
  const developerMode = useAppStore((s) => s.settings?.developerMode ?? false)

  async function refresh() {
    setConfigs(await api.listLeConfigs())
  }
  useEffect(() => {
    void refresh()
    // Cached read — only used to flag installed configs that have a newer catalog version.
    void api.getCatalog().then((s) => setCatalog(s.catalog))
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

  const tree = useMemo(() => buildFolderTree(filtered), [filtered])
  const knownFolders = useMemo(() => folderPaths(configs), [configs])

  function select(c: LeConfig) {
    setSelectedId(c.id)
    setDraft(c)
    setTagsText((c.tags ?? []).join(', '))
    setShowHistory(false)
    setCopied(false)
    setCopyError(null)
  }

  function toggleFolder(path: string) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (!next.delete(path)) next.add(path)
      return next
    })
  }

  /** Rename is a bulk write — one save per affected config, then a single refresh. */
  async function commitRename(from: string, to: string) {
    setRenaming(null)
    const moves = renameFolder(configs, from, to)
    if (!moves.length) return
    for (const { config, folder } of moves) await api.saveLeConfig({ ...config, folder })
    await refresh()
    setDraft((d) => {
      const moved = moves.find((m) => m.config.id === selectedId)
      return moved ? { ...d, folder: moved.folder } : d
    })
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

  /** Only report success if the write actually landed — a silent failure would mean the
   *  maintainer pastes stale clipboard content into catalog.json. */
  async function copyCatalogEntry(config: LeConfig) {
    const json = JSON.stringify(catalogEntryFrom(config), null, 2)
    try {
      await navigator.clipboard.writeText(json)
      setCopied(true)
      setCopyError(null)
    } catch {
      setCopied(false)
      setCopyError(json)
    }
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
          <div className="flex-1 overflow-y-auto grid gap-0.5 pr-1 content-start">
            {filtered.length === 0 && <EmptyState title="No configs" hint="Create or import one." />}
            {tree.map((node) => (
              <FolderBranch
                key={node.path || node.name}
                node={node}
                depth={0}
                collapsed={collapsed}
                onToggle={toggleFolder}
                renaming={renaming}
                setRenaming={setRenaming}
                onRename={commitRename}
                selectedId={selectedId}
                onSelect={select}
                catalog={catalog}
              />
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
            <div className="grid grid-cols-2 gap-3">
              <Field label="Folder">
                <input
                  className="input"
                  list="le-folders"
                  placeholder="Ungrouped — e.g. Maps/Race"
                  value={draft.folder ?? ''}
                  onChange={(e) => setDraft({ ...draft, folder: e.target.value })}
                />
                <datalist id="le-folders">
                  {knownFolders.map((f) => (
                    <option key={f} value={f} />
                  ))}
                </datalist>
              </Field>
              <Field label="Description">
                <input className="input" value={draft.description ?? ''} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
              </Field>
            </div>
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
                  {developerMode && (
                    <Button
                      onClick={() => void copyCatalogEntry(selected)}
                      title="Copy this config as a catalog.json entry, ready to paste on GitHub"
                    >
                      {copied ? <Check size={14} /> : <ClipboardCopy size={14} />}
                      {copied ? 'Copied' : 'Copy catalog entry'}
                    </Button>
                  )}
                  <Button variant="danger" onClick={() => void remove(selected.id)}><Trash2 size={14} /> Delete</Button>
                  <span className="ml-auto text-[11px] text-[var(--text-faint)]">
                    modified {ts(selected.modifiedAt, false)}
                  </span>
                </>
              )}
            </div>

            {copyError && (
              <div className="grid gap-1.5">
                <div className="label">Clipboard unavailable — copy this entry by hand</div>
                <JsonBlock value={copyError} className="max-h-48" />
              </div>
            )}

            {selected?.source && (
              <div className="flex items-center gap-2 flex-wrap text-[12px] text-[var(--text-dim)]">
                <Badge tone="accent">
                  from catalog{selected.source.author ? ` · ${selected.source.author}` : ''}
                </Badge>
                {updateState(selected, catalog) === 'update' ? (
                  <>
                    <Badge tone="warn">update available</Badge>
                    <Link to="/le-catalog" className="text-[var(--accent)] hover:underline">
                      Open the catalog →
                    </Link>
                  </>
                ) : (
                  <span>v{selected.source.version}</span>
                )}
              </div>
            )}

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

/** One folder row plus its children. The Ungrouped bucket has no path and cannot be renamed. */
function FolderBranch({
  node,
  depth,
  collapsed,
  onToggle,
  renaming,
  setRenaming,
  onRename,
  selectedId,
  onSelect,
  catalog
}: {
  node: FolderNode
  depth: number
  collapsed: Set<string>
  onToggle: (path: string) => void
  renaming: { path: string; value: string } | null
  setRenaming: (r: { path: string; value: string } | null) => void
  onRename: (from: string, to: string) => void | Promise<void>
  selectedId: string | null
  onSelect: (c: LeConfig) => void
  catalog: Catalog | null
}) {
  const isUngrouped = !node.path
  const key = node.path || UNGROUPED
  const open = !collapsed.has(key)
  const isRenaming = renaming?.path === node.path && !isUngrouped

  return (
    <div>
      <div
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-[var(--bg-elev-2)] group"
        style={{ paddingLeft: 8 + depth * 12 }}
      >
        <button
          className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
          onClick={() => onToggle(key)}
        >
          {open ? (
            <ChevronDown size={13} className="text-[var(--text-faint)] shrink-0" />
          ) : (
            <ChevronRight size={13} className="text-[var(--text-faint)] shrink-0" />
          )}
          {open ? (
            <FolderOpen size={13} className="text-[var(--accent-2)] shrink-0" />
          ) : (
            <Folder size={13} className="text-[var(--accent-2)] shrink-0" />
          )}
          {isRenaming ? (
            <input
              autoFocus
              className="input h-6 py-0 text-[12px]"
              value={renaming.value}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setRenaming({ path: node.path, value: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void onRename(node.path, parentOf(node.path) + renaming.value)
                if (e.key === 'Escape') setRenaming(null)
              }}
              onBlur={() => setRenaming(null)}
            />
          ) : (
            <>
              <span
                className={cn(
                  'text-[12.5px] truncate',
                  isUngrouped && 'text-[var(--text-faint)] italic'
                )}
              >
                {node.name}
              </span>
              <span className="text-[11px] text-[var(--text-faint)] shrink-0">{node.count}</span>
            </>
          )}
        </button>
        {!isUngrouped && !isRenaming && (
          <button
            className="opacity-0 group-hover:opacity-100 text-[var(--text-faint)] hover:text-[var(--text)]"
            title="Rename folder"
            onClick={() => setRenaming({ path: node.path, value: node.name })}
          >
            <Pencil size={11} />
          </button>
        )}
      </div>

      {open && (
        <>
          {node.children.map((child) => (
            <FolderBranch
              key={child.path}
              node={child}
              depth={depth + 1}
              collapsed={collapsed}
              onToggle={onToggle}
              renaming={renaming}
              setRenaming={setRenaming}
              onRename={onRename}
              selectedId={selectedId}
              onSelect={onSelect}
              catalog={catalog}
            />
          ))}
          {node.configs.map((c) => (
            <button
              key={c.id}
              onClick={() => onSelect(c)}
              className={cn(
                'w-full text-left px-2 py-1.5 rounded-lg hover:bg-[var(--bg-elev-2)]',
                selectedId === c.id && 'bg-[var(--bg-elev-2)] ring-1 ring-[var(--accent-2)]'
              )}
              style={{ paddingLeft: 8 + (depth + 1) * 12 + 14 }}
            >
              <div className="flex items-center gap-1.5">
                {c.favorite && (
                  <Star size={11} className="text-[var(--warn)] fill-[var(--warn)] shrink-0" />
                )}
                <span className="text-[12.5px] truncate">{c.name}</span>
                {updateState(c, catalog) === 'update' && (
                  <span
                    className="ml-auto w-1.5 h-1.5 rounded-full bg-[var(--warn)] shrink-0"
                    title="Update available in the catalog"
                  />
                )}
              </div>
              {(!!c.category || !!c.tags?.length) && (
                <div className="flex items-center gap-1 mt-1 flex-wrap">
                  {c.category && <Badge>{c.category}</Badge>}
                  {c.tags?.slice(0, 2).map((t) => (
                    <Badge key={t}>{t}</Badge>
                  ))}
                </div>
              )}
            </button>
          ))}
        </>
      )}
    </div>
  )
}

/** 'Maps/Race' -> 'Maps/', so a rename edits only the last segment. */
function parentOf(path: string): string {
  const cut = path.lastIndexOf('/')
  return cut === -1 ? '' : path.slice(0, cut + 1)
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
