import { format, formatDistanceToNow } from 'date-fns'

export function ts(ms: number | undefined | null, withSeconds = true): string {
  if (!ms) return '—'
  return format(ms, withSeconds ? 'yyyy-MM-dd HH:mm:ss' : 'yyyy-MM-dd HH:mm')
}

export function ago(ms: number | undefined | null): string {
  if (!ms) return 'never'
  return `${formatDistanceToNow(ms)} ago`
}

export function prettyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

export function regionLabel(region: string): string {
  if (region.startsWith('ap-southeast')) return 'Oceania'
  if (region.startsWith('us-east')) return 'North American'
  if (region.startsWith('eu-central')) return 'European'
  return region
}

export function ms(n: number): string {
  return `${Math.round(n)} ms`
}
