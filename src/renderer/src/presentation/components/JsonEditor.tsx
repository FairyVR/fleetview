import { useRef } from 'react'
import Editor, { DiffEditor } from '@monaco-editor/react'
import { monaco } from '../../lib/monaco-setup'
import type { editor } from 'monaco-editor'
import { Undo2, Redo2, WrapText, Search, Replace } from 'lucide-react'
import { isLightTheme } from '@shared/ipc'
import { useAppStore } from '../../state/useAppStore'
import { Button } from './ui'

function useMonacoTheme(): string {
  const theme = useAppStore((s) => s.settings?.theme)
  return isLightTheme(theme) ? 'light' : 'vs-dark'
}

const OPTIONS: editor.IStandaloneEditorConstructionOptions = {
  minimap: { enabled: false },
  fontSize: 12.5,
  fontFamily: 'Cascadia Code, Consolas, monospace',
  scrollBeyondLastLine: false,
  automaticLayout: true,
  tabSize: 2,
  renderWhitespace: 'selection',
  padding: { top: 10 }
}

/** JSON editor with a toolbar (format, undo/redo, find, replace). Monaco handles the rest. */
export function JsonEditor({
  value,
  onChange,
  height = 420
}: {
  value: string
  onChange: (v: string) => void
  height?: number | string
}) {
  const ref = useRef<editor.IStandaloneCodeEditor | null>(null)
  const monacoTheme = useMonacoTheme()

  const act = (id: string) => ref.current?.getAction(id)?.run()

  return (
    <div className="rounded-lg overflow-hidden border border-[var(--border-soft)]">
      <div className="flex items-center gap-1.5 px-2 py-1.5 bg-[var(--bg-elev-2)] border-b border-[var(--border-soft)]">
        <Button variant="ghost" title="Format" onClick={() => act('editor.action.formatDocument')}>
          <WrapText size={14} /> Format
        </Button>
        <Button variant="ghost" title="Undo" onClick={() => ref.current?.trigger('toolbar', 'undo', null)}>
          <Undo2 size={14} />
        </Button>
        <Button variant="ghost" title="Redo" onClick={() => ref.current?.trigger('toolbar', 'redo', null)}>
          <Redo2 size={14} />
        </Button>
        <Button variant="ghost" title="Find" onClick={() => act('actions.find')}>
          <Search size={14} />
        </Button>
        <Button variant="ghost" title="Replace" onClick={() => act('editor.action.startFindReplaceAction')}>
          <Replace size={14} />
        </Button>
      </div>
      <Editor
        height={height}
        language="json"
        theme={monacoTheme}
        value={value}
        options={OPTIONS}
        onChange={(v) => onChange(v ?? '')}
        onMount={(e) => {
          ref.current = e
        }}
      />
    </div>
  )
}

/** Side-by-side diff view (original vs modified). */
export function JsonDiff({ original, modified, height = 420 }: { original: string; modified: string; height?: number }) {
  const monacoTheme = useMonacoTheme()
  return (
    <div className="rounded-lg overflow-hidden border border-[var(--border-soft)]">
      <DiffEditor
        height={height}
        language="json"
        theme={monacoTheme}
        original={original}
        modified={modified}
        options={{ ...OPTIONS, readOnly: true, renderSideBySide: true }}
      />
    </div>
  )
}

export { validateJson } from '../../lib/validate'
export { monaco }
