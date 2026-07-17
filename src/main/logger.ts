import type { RequestLogEntry } from '@shared/models'

/**
 * In-memory ring buffer of request logs for the Dev Mode API explorer.
 * Persisted logs are intentionally avoided (they can contain response data); the buffer
 * is capped and lives only for the session.
 */
const MAX_ENTRIES = 500
const buffer: RequestLogEntry[] = []
type Listener = (entry: RequestLogEntry) => void
const listeners = new Set<Listener>()

export function recordLog(entry: RequestLogEntry): void {
  buffer.push(entry)
  if (buffer.length > MAX_ENTRIES) buffer.shift()
  for (const l of listeners) l(entry)
}

export function getLogs(): RequestLogEntry[] {
  return [...buffer]
}

export function clearLogs(): void {
  buffer.length = 0
}

export function onLog(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
