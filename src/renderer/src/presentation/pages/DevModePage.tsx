import { useMemo, useState } from 'react'
import { Search, RotateCw, Copy, Download, Trash2, Check } from 'lucide-react'
import type { RequestLogEntry } from '@shared/models'
import { useLogStore } from '../../state/useLogStore'
import { api } from '../../lib/api'
import { ts, ms as fmtMs } from '../../lib/format'
import { PageHeader, Card, Badge, Button, JsonBlock, EmptyState } from '../components/ui'
import { cn } from '../../lib/cn'

function statusTone(e: RequestLogEntry) {
  if (e.error) return 'bad' as const
  if (e.responseStatus && e.responseStatus < 300) return 'good' as const
  return 'warn' as const
}

function toCurl(e: RequestLogEntry): string {
  const lines = [`curl -X ${e.method} '${e.url}'`]
  for (const [k, v] of Object.entries(e.requestHeaders)) lines.push(`  -H '${k}: ${v}'`)
  if (e.requestBody) lines.push(`  -d '${JSON.stringify(e.requestBody)}'`)
  return lines.join(' \\\n')
}

export default function DevModePage() {
  const { logs, clear } = useLogStore()
  const [query, setQuery] = useState('')
  const [onlyErrors, setOnlyErrors] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [copied, setCopied] = useState('')

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return logs
      .filter((e) => (onlyErrors ? !!e.error || (e.responseStatus ?? 0) >= 400 : true))
      .filter((e) => !q || `${e.endpointName} ${e.url} ${e.method}`.toLowerCase().includes(q))
      .slice()
      .reverse()
  }, [logs, query, onlyErrors])

  const selected = logs.find((e) => e.id === selectedId) ?? filtered[0] ?? null

  function copy(id: string, text: string) {
    void navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(''), 1200)
  }

  function exportLog() {
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `fleetview-requests-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function retry(e: RequestLogEntry) {
    await api.request({ endpointId: e.endpointId, params: e.params, body: e.requestBody })
  }

  return (
    <div>
      <PageHeader
        title="Dev Mode · API Explorer"
        subtitle="Every request the app makes, with full URL, headers, bodies, timing, and status. Retry, copy as cURL/JSON, or export the log."
        actions={
          <>
            <Button onClick={exportLog}><Download size={14} /> Export</Button>
            <Button variant="danger" onClick={() => void clear()}><Trash2 size={14} /> Clear</Button>
          </>
        }
      />

      <div className="grid grid-cols-[1fr_1.2fr] gap-4 h-[calc(100vh-190px)]">
        <div className="flex flex-col min-h-0">
          <div className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
              <input className="input pl-9" placeholder="Filter requests…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <Button variant={onlyErrors ? 'primary' : 'default'} onClick={() => setOnlyErrors((v) => !v)}>
              Errors
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto grid gap-1.5 pr-1">
            {filtered.length === 0 && <EmptyState title="No requests yet" hint="Trigger any API call to see it here." />}
            {filtered.map((e) => (
              <button
                key={e.id}
                onClick={() => setSelectedId(e.id)}
                className={cn('card px-3 py-2 text-left', selected?.id === e.id && 'border-[var(--accent-2)]')}
              >
                <div className="flex items-center gap-2">
                  <Badge tone={statusTone(e)}>{e.error ? e.error.kind : e.responseStatus}</Badge>
                  <span className="text-[13px] font-medium truncate">{e.endpointName}</span>
                  <span className="ml-auto text-[11px] text-[var(--text-faint)]">{fmtMs(e.durationMs)}</span>
                </div>
                <div className="mono text-[11px] text-[var(--text-dim)] mt-1 truncate">{e.method} {e.url}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-y-auto">
          {selected ? (
            <Card className="grid gap-4">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge tone={statusTone(selected)}>
                  {selected.error ? selected.error.kind : `${selected.responseStatus} ${selected.responseStatusText}`}
                </Badge>
                <span className="font-semibold">{selected.endpointName}</span>
                <Badge>{fmtMs(selected.durationMs)}</Badge>
                {selected.retries > 0 && <Badge tone="warn">{selected.retries} retries</Badge>}
                <span className="ml-auto text-[11px] text-[var(--text-faint)]">{ts(selected.timestamp)}</span>
              </div>

              <div className="mono text-[12px] break-all p-2.5 rounded-lg bg-[var(--bg)] border border-[var(--border-soft)]">
                {selected.method} {selected.url}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={() => copy('curl', toCurl(selected))}>
                  {copied === 'curl' ? <Check size={13} /> : <Copy size={13} />} cURL
                </Button>
                <Button onClick={() => copy('json', JSON.stringify(selected, null, 2))}>
                  {copied === 'json' ? <Check size={13} /> : <Copy size={13} />} JSON
                </Button>
                <Button variant="primary" onClick={() => void retry(selected)}>
                  <RotateCw size={13} /> Retry
                </Button>
              </div>

              <div>
                <div className="label">Request headers</div>
                <JsonBlock value={selected.requestHeaders} />
              </div>
              {selected.requestBody != null && (
                <div>
                  <div className="label">Request body</div>
                  <JsonBlock value={selected.requestBody} />
                </div>
              )}
              <div>
                <div className="label">Response</div>
                <JsonBlock value={selected.error ?? selected.responseBody} className="max-h-72" />
              </div>
            </Card>
          ) : (
            <Card className="h-full grid place-items-center text-[13px] text-[var(--text-dim)]">
              Select a request to inspect it.
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
