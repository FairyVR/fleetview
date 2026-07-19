import { NavLink, useLocation } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import badge from '../../assets/founder_badge.png'
import wordmark from '../../assets/od-wordmark.png'
import type { ReactNode } from 'react'
import { NAV } from '../nav'
import { cn } from '../../lib/cn'
import { useAppStore } from '../../state/useAppStore'
import { StatusDot } from './ui'
import type { KeyHealth } from '@shared/models'

function healthTone(h: KeyHealth): 'good' | 'warn' | 'bad' | 'idle' {
  if (h === 'valid') return 'good'
  if (h === 'invalid' || h === 'expired') return 'bad'
  if (h === 'error') return 'warn'
  return 'idle'
}

function KeySwitcher() {
  const { keys, activeKeyId, setActiveKey } = useAppStore()
  const active = keys.find((k) => k.id === activeKeyId)
  return (
    <div className="relative">
      <div className="flex items-center gap-2 px-3 h-9 rounded-lg border border-[var(--border)] bg-[var(--bg-elev-2)]">
        <StatusDot status={active ? healthTone(active.health) : 'idle'} />
        <select
          className="bg-transparent text-[13px] outline-none appearance-none pr-5 max-w-[220px] text-[var(--text)]"
          value={activeKeyId ?? ''}
          onChange={(e) => void setActiveKey(e.target.value || null)}
        >
          {keys.length === 0 && <option value="">No keys — add one</option>}
          {keys.map((k) => (
            <option key={k.id} value={k.id}>
              {k.name}
              {k.owner ? ` · ${k.owner}` : ''}
            </option>
          ))}
        </select>
        <ChevronDown size={14} className="absolute right-2.5 pointer-events-none text-[var(--text-faint)]" />
      </div>
    </div>
  )
}

export function Layout({ children }: { children: ReactNode }) {
  const location = useLocation()
  const settings = useAppStore((s) => s.settings)
  const baseUrl = settings?.baseUrl ?? ''
  // The real host is https://api.oriondrift.net; flag anything unset/obviously wrong.
  const placeholderBase = !baseUrl || baseUrl.includes('example')

  return (
    <div className="grid grid-cols-[248px_1fr] h-screen">
      {/* Sidebar */}
      <aside className="flex flex-col border-r border-[var(--border-soft)] bg-[var(--bg-elev)] overflow-hidden">
        <div className="flex items-center gap-2.5 px-4 h-14 border-b border-[var(--border-soft)] shrink-0">
          <img src={badge} alt="Orion Drift founder badge" className="w-8 h-8 object-contain" />
          <div className="leading-tight">
            <div className="font-semibold tracking-tight">FleetView</div>
            <div className="text-[10.5px] text-[var(--text-faint)]">Orion Drift control</div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-3 px-2.5">
          {NAV.map((group) => (
            <div key={group.title} className="mb-4">
              <div className="text-[10.5px] uppercase tracking-wider text-[var(--text-faint)] px-2.5 mb-1.5">
                {group.title}
              </div>
              {group.items.map((item) => {
                const Icon = item.icon
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2.5 px-2.5 h-8 rounded-md text-[13px] mb-0.5 transition-colors',
                        isActive
                          ? 'bg-[var(--bg-elev-2)] text-[var(--text)]'
                          : 'text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--bg-elev-2)]/50'
                      )
                    }
                  >
                    <Icon size={15} />
                    {item.label}
                  </NavLink>
                )
              })}
            </div>
          ))}
        </nav>
        <div className="px-4 py-3 border-t border-[var(--border-soft)] shrink-0">
          <img src={wordmark} alt="Orion Drift" className="w-full max-w-[140px] mx-auto opacity-40" />
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-col overflow-hidden">
        <header className="flex items-center justify-between px-5 h-14 border-b border-[var(--border-soft)] bg-[var(--bg-elev)]/60 shrink-0">
          <div className="flex items-center gap-2 text-[12px] text-[var(--text-faint)] mono truncate">
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: placeholderBase ? 'var(--warn)' : 'var(--good)' }}
            />
            {baseUrl || 'no base URL set'}
            {placeholderBase && <span className="text-[var(--warn)]">· not set — configure in Settings</span>}
          </div>
          <KeySwitcher />
        </header>
        <main key={location.pathname} className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
