import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react'
import { useToastStore, type ToastTone } from '../../state/useToastStore'

const TONE: Record<ToastTone, { color: string; Icon: typeof Info }> = {
  good: { color: 'var(--good)', Icon: CheckCircle2 },
  bad: { color: 'var(--bad)', Icon: AlertTriangle },
  info: { color: 'var(--accent)', Icon: Info }
}

/** Transient confirmations for writes, stacked bottom-right. Mounted once, in the Layout. */
export function Toaster() {
  const { toasts, dismiss } = useToastStore()
  if (toasts.length === 0) return null
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => {
        const { color, Icon } = TONE[t.tone]
        return (
          <div
            key={t.id}
            role="status"
            className="card pointer-events-auto flex items-center gap-2.5 pl-3 pr-2 py-2.5 min-w-[240px] max-w-[380px] shadow-lg"
            style={{
              borderColor: `color-mix(in srgb, ${color} 35%, transparent)`,
              animation: 'fv-rise 0.16s ease-out'
            }}
          >
            <Icon size={15} style={{ color }} className="shrink-0" />
            <span className="text-[13px] flex-1">{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              className="btn btn-ghost px-1.5 py-1 text-[var(--text-faint)]"
            >
              <X size={13} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
