import { useState, useEffect, useRef, useMemo } from 'react'
import { RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'
import type { ServerEvent } from '@shared/models'
import { useEndpoint } from '../../services/useEndpoint'
import { PageHeader, Button, Badge, Field, JsonBlock, Card } from '../components/ui'
import { RequestResult } from '../components/RequestResult'
import { StationScoped } from '../components/StationScoped'
import { ts } from '../../lib/format'

/**
 * Live shape: { page, items: [{ idx, event_type, station_id, event_data, timestamp }] }
 * where `event_data` is a JSON *string* and `timestamp` is an ISO date string.
 */
function asEvents(data: unknown): ServerEvent[] {
  const d = data as { items?: unknown[]; events?: unknown[] } | unknown[]
  const arr = Array.isArray(d) ? d : (d?.items ?? d?.events ?? [])
  return (arr as Record<string, unknown>[]).map((e) => {
    let parsed: Record<string, unknown> | undefined
    if (typeof e.event_data === 'string') {
      try {
        parsed = JSON.parse(e.event_data)
      } catch {
        parsed = { _raw: e.event_data }
      }
    }
    const t = typeof e.timestamp === 'string' ? Date.parse(e.timestamp) : Number(e.timestamp ?? 0)
    return {
      id: String(e.idx ?? e.id ?? e.eventId ?? ''),
      timestamp: Number.isNaN(t) ? 0 : t,
      type: String(e.event_type ?? e.type ?? 'unknown'),
      stationId: (e.station_id ?? e.stationId) as string | undefined,
      message: e.message as string | undefined,
      data: parsed ?? ((e.data as Record<string, unknown>) ?? {}),
      raw: e
    }
  })
}

export default function EventsPage() {
  return (
    <div>
      <PageHeader title="Server Events" subtitle="Real-time events from the selected station." />
      <StationScoped>{(stationId) => <EventsViewer stationId={stationId} />}</StationScoped>
    </div>
  )
}

function EventsViewer({ stationId }: { stationId: string }) {
  const { data, response, loading, run } = useEndpoint<unknown>('events.station', {
    params: { stationId },
    auto: true
  })
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(() => {
        void run()
      }, 4000)
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [autoRefresh, run])

  const events = asEvents(data)

  const uniqueTypes = useMemo(() => {
    return Array.from(new Set(events.map((e) => e.type)))
  }, [events])

  const [selectedType, setSelectedType] = useState<string | null>(null)

  const filtered = useMemo(() => {
    return events.filter((e) => {
      const matchesSearch =
        searchTerm === '' ||
        e.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (e.message?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false)
      const matchesType = selectedType === null || e.type === selectedType
      return matchesSearch && matchesType
    })
  }, [events, searchTerm, selectedType])

  return (
    <div>
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <Button
          variant={autoRefresh ? 'primary' : 'default'}
          onClick={() => setAutoRefresh(!autoRefresh)}
        >
          <RefreshCw size={14} className={autoRefresh ? 'animate-spin' : ''} /> Auto-refresh
        </Button>
        <Button onClick={() => void run()} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Manual refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-4">
        <div className="lg:col-span-2">
          <Field label="Search events">
            <input
              className="input"
              placeholder="Type or message…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </Field>
        </div>
        <div className="lg:col-span-2">
          <Field label="Filter by type">
            <select
              className="input"
              value={selectedType ?? ''}
              onChange={(e) => setSelectedType(e.target.value || null)}
            >
              <option value="">All types</option>
              {uniqueTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      <RequestResult response={response} loading={loading} onRetry={() => void run()}>
        {() => (
          <div className="space-y-2">
            {filtered.length === 0 ? (
              <Card>
                <p className="text-[12px] text-[var(--text-dim)]">No events match the filters.</p>
              </Card>
            ) : (
              filtered.map((event) => {
                const isExpanded = expandedId === event.id
                return (
                  <Card key={event.id}>
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : event.id)}
                      className="w-full text-left flex items-start justify-between gap-2"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-[11px] text-[var(--text-dim)] mono">
                            {ts(event.timestamp)}
                          </span>
                          <Badge tone="accent">{event.type}</Badge>
                        </div>
                        {event.message && (
                          <p className="text-[12px] text-[var(--text-dim)] truncate">
                            {event.message}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0 text-[var(--text-faint)]">
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-[var(--border-soft)]">
                        <JsonBlock value={event.raw} className="max-h-64" />
                      </div>
                    )}
                  </Card>
                )
              })
            )}
          </div>
        )}
      </RequestResult>
    </div>
  )
}
