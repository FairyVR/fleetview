import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import type { HttpMethod } from '@shared/models'
import { useLogStore } from '../../state/useLogStore'
import { ts, ms as fmtMs } from '../../lib/format'
import { PageHeader, Card, Badge, Button, JsonBlock, EmptyState } from '../components/ui'

const METHODS: (HttpMethod | 'ALL')[] = ['ALL', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE']

export default function LogsPage() {
  const { logs, clear } = useLogStore()
  const [query, setQuery] = useState('')
  const [method, setMethod] = useState<HttpMethod | 'ALL'>('ALL')
  const [expanded, setExpanded] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return logs
      .filter((e) => (method === 'ALL' ? true : e.method === method))
      .filter((e) => !q || `${e.endpointName} ${e.url}`.toLowerCase().includes(q))
      .slice()
      .reverse()
  }, [logs, query, method])

  return (
    <div>
      <PageHeader
        title="Logs"
        subtitle="Chronological request/response log with timing. Every API call is recorded here for the session."
        actions={<Button variant="danger" onClick={() => void clear()}>Clear</Button>}
      />

      <div className="flex gap-2 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
          <input className="input pl-9" placeholder="Search…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <select className="input w-auto" value={method} onChange={(e) => setMethod(e.target.value as HttpMethod | 'ALL')}>
          {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <Card><EmptyState title="No log entries" hint="API calls will stream in here." /></Card>
      ) : (
        <div className="grid gap-1.5">
          {filtered.map((e) => (
            <Card key={e.id} className="!p-0 overflow-hidden">
              <button
                className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left"
                onClick={() => setExpanded(expanded === e.id ? null : e.id)}
              >
                <span className="text-[11px] text-[var(--text-faint)] mono w-[150px] shrink-0">{ts(e.timestamp)}</span>
                <Badge tone={e.error ? 'bad' : (e.responseStatus ?? 0) < 300 ? 'good' : 'warn'}>
                  {e.error ? e.error.kind : e.responseStatus}
                </Badge>
                <Badge>{e.method}</Badge>
                <span className="text-[13px] truncate flex-1">{e.endpointName}</span>
                <span className="text-[11px] text-[var(--text-faint)]">{fmtMs(e.durationMs)}</span>
              </button>
              {expanded === e.id && (
                <div className="px-3.5 pb-3.5 grid gap-2">
                  <div className="mono text-[11px] text-[var(--text-dim)] break-all">{e.url}</div>
                  <JsonBlock value={e.error ?? e.responseBody} className="max-h-56" />
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
