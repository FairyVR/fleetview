import type { ReactNode, ButtonHTMLAttributes } from 'react'
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

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
    </label>
  )
}
