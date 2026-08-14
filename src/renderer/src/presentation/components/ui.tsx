import type { ReactNode, ButtonHTMLAttributes } from 'react'
import { Check, Circle } from 'lucide-react'
import { cn } from '../../lib/cn'
import { prettyJson } from '../../lib/format'

export function Button({
  variant = 'default',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'primary' | 'danger' | 'ghost'
}) {
  return (
    <button
      className={cn(
        'btn',
        variant === 'primary' && 'btn-primary',
        variant === 'danger' && 'btn-danger',
        variant === 'ghost' && 'btn-ghost',
        className
      )}
      {...props}
    />
  )
}

/** A filter switch. Styled as a chip so it reads as a filter, not a button. */
export function FilterToggle({
  on,
  onClick,
  children
}: {
  on: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={cn('btn', on && 'border-[var(--accent-2)] text-[var(--text)] bg-[var(--bg-elev-2)]')}
    >
      {on ? (
        <Check size={13} className="text-[var(--accent)]" />
      ) : (
        <Circle size={13} className="text-[var(--text-faint)]" />
      )}
      {children}
    </button>
  )
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('card p-4', className)}>{children}</div>
}

export function PageHeader({
  title,
  subtitle,
  actions
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-[13px] text-[var(--text-dim)] mt-1 max-w-2xl">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  )
}

export function StatusDot({ status }: { status: 'good' | 'warn' | 'bad' | 'idle' }) {
  const color =
    status === 'good'
      ? 'var(--good)'
      : status === 'warn'
        ? 'var(--warn)'
        : status === 'bad'
          ? 'var(--bad)'
          : 'var(--text-faint)'
  return (
    <span
      className="inline-block w-2 h-2 rounded-full shrink-0"
      style={{ background: color, boxShadow: `0 0 8px ${color}` }}
    />
  )
}

export function Badge({
  children,
  tone = 'neutral'
}: {
  children: ReactNode
  tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'accent'
}) {
  const map = {
    neutral: 'var(--text-dim)',
    good: 'var(--good)',
    warn: 'var(--warn)',
    bad: 'var(--bad)',
    accent: 'var(--accent)'
  } as const
  return (
    <span
      className="chip"
      style={{ color: map[tone], borderColor: `color-mix(in srgb, ${map[tone]} 35%, transparent)` }}
    >
      {children}
    </span>
  )
}

export function EmptyState({
  icon,
  title,
  hint,
  action
}: {
  icon?: ReactNode
  title: string
  hint?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      {icon && <div className="text-[var(--text-faint)] mb-3">{icon}</div>}
      <div className="text-[15px] font-medium">{title}</div>
      {hint && <div className="text-[13px] text-[var(--text-dim)] mt-1.5 max-w-md">{hint}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-[var(--bg-elev-2)]', className)} />
}

/**
 * Placeholder rows shaped like the card lists every page renders, so content arriving
 * doesn't shift the layout the way swapping out a centred spinner does.
 */
export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2.5" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="card p-4 flex items-center gap-4" style={{ opacity: 1 - i * 0.12 }}>
          <Skeleton className="w-9 h-9 rounded-lg shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="w-16 h-6 rounded-full shrink-0" />
        </div>
      ))}
    </div>
  )
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-[13px] text-[var(--text-dim)] py-8 justify-center">
      <span className="inline-block w-4 h-4 border-2 border-[var(--border)] border-t-[var(--accent)] rounded-full animate-spin" />
      {label ?? 'Loading…'}
    </div>
  )
}

export function JsonBlock({ value, className }: { value: unknown; className?: string }) {
  return (
    <pre
      className={cn(
        'mono text-[12px] leading-relaxed p-3 rounded-lg overflow-auto bg-[var(--bg)] border border-[var(--border-soft)]',
        className
      )}
    >
      {typeof value === 'string' ? value : prettyJson(value)}
    </pre>
  )
}

/** How to obtain an Orion Drift dashboard API key. Shown anywhere a key is missing/being added. */
export function ApiKeyHowTo({ className }: { className?: string }) {
  return (
    <div className={cn('text-[12px] text-[var(--text-dim)] text-left', className)}>
      <div className="text-[var(--text-faint)] mb-1.5">How to get a key</div>
      <ol className="list-decimal pl-4 space-y-1">
        <li>
          Open{' '}
          <a
            href="https://dashboard.oriondrift.net/"
            target="_blank"
            rel="noreferrer"
            className="text-[var(--accent)] underline underline-offset-2"
          >
            dashboard.oriondrift.net
          </a>
        </li>
        <li>Click the face icon in the top right</li>
        <li>
          Click <span className="text-[var(--text)]">Create Key</span>
        </li>
        <li>Copy the key and paste it here</li>
      </ol>
    </div>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
    </label>
  )
}
