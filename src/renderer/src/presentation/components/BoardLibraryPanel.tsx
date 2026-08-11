import { useState } from 'react'
import { Bookmark, BookmarkCheck, Check, Layers, Link2, Plus, Save, Trash2, X } from 'lucide-react'
import { Badge, Button, Card, Field } from './ui'
import {
  slotEntries,
  urlLabel,
  type BoardSet,
  type SlotEntry,
  type SlotLibrary
} from '../../lib/boardLibrary'

/** One saved configuration as the bar knows it. */
export interface SavedSet {
  id: string
  name: string
  set: BoardSet
  /** How many boards it would change right now — 0 means it is already applied. */
  changes: number
}

/**
 * The saved-configuration bar above the board grid: apply a whole configuration in one click,
 * or capture the current one under a name. Applying only stages the URLs into the editor —
 * writing them is still the existing Save all, so ten remote writes never happen by accident.
 */
export function BoardSetBar({
  sets,
  onApply,
  onSave,
  onDelete,
  busy
}: {
  sets: SavedSet[]
  onApply: (set: SavedSet) => void
  onSave: (name: string) => void
  onDelete: (set: SavedSet) => void
  busy: boolean
}) {
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')

  function save() {
    const trimmed = name.trim()
    if (!trimmed) return
    onSave(trimmed)
    setName('')
    setNaming(false)
  }

  return (
    <Card className="grid gap-3 mb-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Layers size={15} className="text-[var(--accent)]" />
        <span className="font-medium">Saved configurations</span>
        <span className="text-[11px] text-[var(--text-faint)]">
          Applying stages every board — review the previews, then Save all.
        </span>
        <div className="ml-auto">
          <Button onClick={() => setNaming((v) => !v)} disabled={busy}>
            <Plus size={13} /> Save current
          </Button>
        </div>
      </div>

      {naming && (
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Field label="Configuration name">
              <input
                className="input"
                autoFocus
                value={name}
                placeholder="Halloween 2026"
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') save()
                  if (e.key === 'Escape') setNaming(false)
                }}
              />
            </Field>
          </div>
          <Button variant="primary" onClick={save} disabled={!name.trim()}>
            <Save size={13} /> Save
          </Button>
          <Button onClick={() => setNaming(false)}>Cancel</Button>
        </div>
      )}

      {sets.length ? (
        <div className="flex flex-wrap gap-2">
          {sets.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-1 rounded-lg border border-[var(--border-soft)] bg-[var(--bg-elev-2)] px-2 py-1"
            >
              <button
                className="chip"
                title={`Stage ${Object.keys(s.set).length} boards from "${s.name}"`}
                onClick={() => onApply(s)}
                disabled={busy}
              >
                {s.name}
              </button>
              {s.changes === 0 ? (
                <Badge tone="good">
                  <Check size={11} /> applied
                </Badge>
              ) : (
                <span className="text-[11px] text-[var(--text-faint)]">
                  {s.changes} to change
                </span>
              )}
              <button
                className="chip"
                title={`Delete "${s.name}"`}
                onClick={() => onDelete(s)}
                disabled={busy}
              >
                <Trash2 size={11} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <span className="text-[12px] text-[var(--text-faint)]">
          No saved configurations yet — set your boards up, then "Save current".
        </span>
      )}
    </Card>
  )
}

/** One clickable URL in a board's picker. */
function EntryChip({
  entry,
  current,
  onUse,
  onPin,
  onRemove
}: {
  entry: SlotEntry
  current: boolean
  onUse: () => void
  onPin: () => void
  onRemove: () => void
}) {
  return (
    <div
      className="flex items-center gap-1 rounded-lg border border-[var(--border-soft)] bg-[var(--bg-elev-2)] px-2 py-1"
      style={current ? { borderColor: 'var(--accent)' } : undefined}
    >
      <button className="chip mono text-[11px]" title={entry.url} onClick={onUse}>
        {entry.name ?? urlLabel(entry.url)}
      </button>
      <button
        className="chip"
        title={entry.pinned ? 'Remove from saved list' : 'Save to this board’s list'}
        onClick={onPin}
      >
        {entry.pinned ? <BookmarkCheck size={11} /> : <Bookmark size={11} />}
      </button>
      <button className="chip" title="Forget this URL" onClick={onRemove}>
        <X size={11} />
      </button>
    </div>
  )
}

/**
 * A board's own URL picker: paste a link, or pick one off this board's saved list or its recent
 * history. Recent entries are recorded automatically whenever a URL is successfully applied,
 * so swapping back to last week's texture never needs to have been planned for.
 */
export function BoardUrlPicker({
  slot,
  library,
  currentUrl,
  onUse,
  onPin,
  onRemove
}: {
  slot: number
  library: SlotLibrary
  currentUrl: string
  onUse: (url: string) => void
  onPin: (url: string, pinned: boolean) => void
  onRemove: (url: string) => void
}) {
  const [link, setLink] = useState('')
  const { saved, recent } = slotEntries(library, slot)

  function useLink() {
    const url = link.trim()
    if (!url) return
    onUse(url)
    setLink('')
  }

  const section = (label: string, entries: SlotEntry[], empty: string) => (
    <div className="grid gap-1">
      <span className="text-[11px] text-[var(--text-faint)]">{label}</span>
      {entries.length ? (
        <div className="flex flex-wrap gap-2">
          {entries.map((e) => (
            <EntryChip
              key={e.url}
              entry={e}
              current={e.url === currentUrl}
              onUse={() => onUse(e.url)}
              onPin={() => onPin(e.url, !e.pinned)}
              onRemove={() => onRemove(e.url)}
            />
          ))}
        </div>
      ) : (
        <span className="text-[11px] text-[var(--text-faint)]">{empty}</span>
      )}
    </div>
  )

  return (
    <div className="grid gap-3 rounded-lg border border-[var(--border-soft)] bg-[var(--bg)] p-3">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Field label="Add a link">
            <input
              className="input mono text-[12px]"
              value={link}
              placeholder="https://…/texture.png"
              onChange={(e) => setLink(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && useLink()}
            />
          </Field>
        </div>
        <Button variant="primary" onClick={useLink} disabled={!link.trim()}>
          <Link2 size={13} /> Use
        </Button>
      </div>

      {section('Saved list', saved, 'Nothing saved for this board yet — bookmark a URL to keep it.')}
      {section('Recent', recent, 'No history yet — applied URLs show up here.')}
    </div>
  )
}
