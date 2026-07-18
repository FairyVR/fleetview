import { useMemo, useState } from 'react'
import { Search, Copy, Play, Check } from 'lucide-react'
import type { EndpointDef } from '@shared/registry'
import { endpoints, searchEndpoints, buildUrl } from '@shared/registry'
import type { ApiResponse } from '@shared/models'
import { api } from '../../lib/api'
import { useAppStore } from '../../state/useAppStore'
import { PageHeader, Card, Badge, Button, JsonBlock } from '../components/ui'
import { cn } from '../../lib/cn'

const CATEGORIES = ['all', ...Array.from(new Set(endpoints.map((e) => e.category)))]

function methodTone(m: string) {
  return m === 'GET' ? 'accent' : m === 'DELETE' ? 'bad' : 'warn'
}

function exampleParams(e: EndpointDef): Record<string, string | number | boolean> {
  const p: Record<string, string | number | boolean> = {}
  for (const param of e.params ?? []) if (param.example !== undefined) p[param.name] = param.example
  return p
}

export default function EndpointExplorerPage() {
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState('all')
  const [selected, setSelected] = useState<EndpointDef | null>(null)
  const baseUrl = useAppStore((s) => s.settings?.baseUrl ?? '')

  const results = useMemo(() => {
    let list = searchEndpoints(query)
    if (cat !== 'all') list = list.filter((e) => e.category === cat)
    return list
  }, [query, cat])

  return (
    <div>
      <PageHeader
        title="Endpoint Explorer"
        subtitle={`Every endpoint in the registry (${endpoints.length}). Search, filter, copy, and test. This is the single source of truth — add a verified endpoint to the registry and it appears here automatically.`}
      />

      <div className="grid grid-cols-[1fr_1.1fr] gap-4 h-[calc(100vh-190px)]">
        {/* List */}
        <div className="flex flex-col min-h-0">
          <div className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
              <input
                className="input pl-9"
                placeholder="Search endpoints…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <select className="input w-auto" value={cat} onChange={(e) => setCat(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 overflow-y-auto grid gap-1.5 pr-1">
            {results.map((e) => (
              <button
                key={e.id}
                onClick={() => setSelected(e)}
                className={cn(
                  'card px-3 py-2.5 text-left transition-colors',
                  selected?.id === e.id ? 'border-[var(--accent-2)]' : 'hover:border-[var(--border)]'
                )}
              >
                <div className="flex items-center gap-2">
                  <Badge tone={methodTone(e.method)}>{e.method}</Badge>
                  <span className="font-medium text-[13px]">{e.name}</span>
                  {e.status === 'unverified' && <Badge tone="warn">unverified</Badge>}
                </div>
                <div className="mono text-[11.5px] text-[var(--text-dim)] mt-1 truncate">{e.path}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Detail */}
        <div className="overflow-y-auto">
          {selected ? (
            <EndpointDetail endpoint={selected} baseUrl={baseUrl} />
          ) : (
            <Card className="h-full grid place-items-center text-[13px] text-[var(--text-dim)]">
              Select an endpoint to view its contract and test it.
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

function EndpointDetail({ endpoint, baseUrl }: { endpoint: EndpointDef; baseUrl: string }) {
  const [result, setResult] = useState<ApiResponse | null>(null)
  const [testing, setTesting] = useState(false)
  const [copied, setCopied] = useState('')

  const params = exampleParams(endpoint)
  const { path } = buildUrl(endpoint, params)
  const fullUrl = `${baseUrl.replace(/\/+$/, '')}${path}`

  function copy(what: string, text: string) {
    void navigator.clipboard.writeText(text)
    setCopied(what)
    setTimeout(() => setCopied(''), 1200)
  }

  const curl = [
    `curl -X ${endpoint.method} '${fullUrl}'`,
    endpoint.requiresAuth ? `  -H 'x-api-key: <API_KEY>'` : '',
    endpoint.requestExample ? `  -H 'Content-Type: application/json'` : '',
    endpoint.requestExample ? `  -d '${JSON.stringify(endpoint.requestExample)}'` : ''
  ]
    .filter(Boolean)
    .join(' \\\n')

  async function test() {
    setTesting(true)
    const res = await api.request({ endpointId: endpoint.id, params })
    setResult(res)
    setTesting(false)
  }

  const CopyBtn = ({ id, text }: { id: string; text: string }) => (
    <Button onClick={() => copy(id, text)}>
      {copied === id ? <Check size={13} /> : <Copy size={13} />} {id}
    </Button>
  )

  return (
    <Card className="grid gap-4">
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge tone={methodTone(endpoint.method)}>{endpoint.method}</Badge>
          <span className="font-semibold">{endpoint.name}</span>
          <Badge>{endpoint.category}</Badge>
          <Badge tone={endpoint.permission === 'none' ? 'neutral' : 'accent'}>{endpoint.permission}</Badge>
          <Badge tone={endpoint.status === 'verified' ? 'good' : 'warn'}>{endpoint.status}</Badge>
        </div>
        <p className="text-[13px] text-[var(--text-dim)] mt-2">{endpoint.description}</p>
        {endpoint.notes && <p className="text-[12px] text-[var(--warn)] mt-1.5">{endpoint.notes}</p>}
      </div>

      <div>
        <div className="label">Request URL</div>
        <div className="mono text-[12px] p-2.5 rounded-lg bg-[var(--bg)] border border-[var(--border-soft)] break-all">
          {fullUrl}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <CopyBtn id="URL" text={fullUrl} />
        <CopyBtn id="cURL" text={curl} />
        <CopyBtn id="id" text={endpoint.id} />
        <Button variant="primary" disabled={testing} onClick={() => void test()}>
          <Play size={13} /> {testing ? 'Testing…' : 'Test'}
        </Button>
      </div>

      {endpoint.params?.length ? (
        <div>
          <div className="label">Parameters</div>
          <div className="grid gap-1">
            {endpoint.params.map((p) => (
              <div key={p.name} className="flex items-center gap-2 text-[12px]">
                <span className="mono text-[var(--accent)]">{p.name}</span>
                <Badge>{p.in}</Badge>
                {p.required && <Badge tone="warn">required</Badge>}
                {p.example !== undefined && <span className="text-[var(--text-faint)]">e.g. {String(p.example)}</span>}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {endpoint.requestExample ? (
        <div>
          <div className="label">Example request body</div>
          <JsonBlock value={endpoint.requestExample} />
        </div>
      ) : null}

      {endpoint.responseExample ? (
        <div>
          <div className="label">Example response</div>
          <JsonBlock value={endpoint.responseExample} />
        </div>
      ) : null}

      {endpoint.statusCodes ? (
        <div>
          <div className="label">Status codes</div>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(endpoint.statusCodes).map(([code, meaning]) => (
              <Badge key={code} tone={Number(code) < 300 ? 'good' : 'bad'}>
                {code} · {meaning}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}

      {result && (
        <div>
          <div className="label flex items-center gap-2">
            Live test result
            <Badge tone={result.ok ? 'good' : 'bad'}>
              {result.status || result.error?.kind} · {Math.round(result.durationMs)}ms
            </Badge>
          </div>
          <JsonBlock value={result.error ? result.error : result.data} className="max-h-64" />
        </div>
      )}
    </Card>
  )
}
