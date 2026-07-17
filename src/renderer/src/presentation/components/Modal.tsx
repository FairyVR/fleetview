import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { Button } from './ui'

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  wide
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/55"
      onClick={onClose}
    >
      <div
        className="card w-full flex flex-col max-h-[85vh]"
        style={{ maxWidth: wide ? 900 : 520 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border-soft)]">
          <h2 className="font-semibold">{title}</h2>
          <Button variant="ghost" onClick={onClose} aria-label="Close">
            <X size={16} />
          </Button>
        </div>
        <div className="p-5 overflow-auto">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 px-5 py-3.5 border-t border-[var(--border-soft)]">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
