import { NavLink, useLocation } from 'react-router-dom'
import { ChevronDown, Rocket, Server } from 'lucide-react'
import badge from '../../assets/founder_badge.png'
import wordmark from '../../assets/od-wordmark.png'
import { useEffect, type ReactNode } from 'react'
import { NAV, DANGER_NAV } from '../nav'
import { cn } from '../../lib/cn'
import { useAppStore } from '../../state/useAppStore'
import { useSelectionStore, type FleetOption } from '../../state/useSelectionStore'
import { useEndpoint } from '../../services/useEndpoint'
import { fleetAccess, sortByAccess } from '../../lib/fleetAccess'
import { StatusDot } from './ui'
import type { KeyHealth } from '@shared/models'

function healthTone(h: KeyHealth): 'good' | 'warn' | 'bad' | 'idle' {
  if (h === 'valid') return 'good'
  if (h === 'invalid' || h === 'expired') return 'bad'
  if (h === 'error') return 'warn'
  return 'idle'
}

/** The header's dropdown chrome — one bordered pill, shared by every switcher. */
function Pill({
  lead,
  value,
  onChange,
  width,
  children
}: {
  lead: ReactNode
  value: string
  onChange: (v: string) => void
  width: string
  children: ReactNode
}) {
  return (
    <div className="group relative flex items-center gap-2 px-3 h-9 rounded-lg border border-[var(--border)] bg-[var(--bg-elev-2)] transition-colors hover:border-[var(--accent-2)] focus-within:border-[var(--accent-2)]">
      {lead}
      <select
        className={cn(
          'bg-transparent text-[13px] outline-none appearance-none pr-5 text-[var(--text)] cursor-pointer truncate',
          width
        )}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {children}
      </select>
      <ChevronDown
        size={14}
        className="absolute right-2.5 pointer-events-none text-[var(--text-faint)] transition-colors group-hover:text-[var(--accent)]"
      />
    </div>
  )
}

function KeySwitcher() {
  const { keys, activeKeyId, setActiveKey } = useAppStore()
  const active = keys.find((k) => k.id === activeKeyId)
  return (
    <Pill
      lead={<StatusDot status={active ? healthTone(active.health) : 'idle'} />}
      value={activeKeyId ?? ''}
      onChange={(v) => void setActiveKey(v || null)}
      width="max-w-[220px]"
    >
      {keys.length === 0 && <option value="">No keys — add one</option>}
      {keys.map((k) => (
        <option key={k.id} value={k.id}>
          {k.owner || k.name}
        </option>
      ))}
    </Pill>
  )
}

/** Real API: fleets carry fleet_id/fleet_name and an embedded stations array. */
function asFleetOptions(data: unknown): FleetOption[] {
  const d = data as { items?: unknown[]; fleets?: unknown[] } | unknown[] | null
  const arr = Array.isArray(d) ? d : (d?.items ?? d?.fleets ?? [])
  if (!Array.isArray(arr)) return []
  return (arr as Record<string, unknown>[]).map((f) => ({
    id: String(f.fleet_id ?? f.id ?? ''),
    name: String(f.fleet_name ?? f.name ?? f.fleet_id ?? 'Unnamed fleet'),
    stations: (Array.isArray(f.stations) ? (f.stations as Record<string, unknown>[]) : []).map((s) => ({
      id: String(s.station_id ?? s.id ?? ''),
      name: String(s.station_name ?? s.name ?? s.station_id ?? 'Unnamed station')
    }))
  }))
}

/**
 * Fleet + station context, switchable from anywhere. Owns the single `fleet.list` call
 * and caches it into the selection store so pages read stations instead of refetching.
 */
function ContextSwitcher() {
  const activeKeyId = useAppStore((s) => s.activeKeyId)
  const grants = useAppStore((s) => s.permissions.grants ?? {})
  const { fleetId, fleetName, stationId, stationName, fleets, selectFleet, selectStation, setFleets } =
    useSelectionStore()
  const { data } = useEndpoint('fleet.list', {
    params: { include_stations: true, include_offline_fleets: false, page_size: 32, page: 1 },
    auto: true,
    enabled: !!activeKeyId
  })

  useEffect(() => {
    if (data) setFleets(asFleetOptions(data))
  }, [data, setFleets])

  const current = fleets.find((f) => f.id === fleetId)
  const stations = current?.stations ?? []

  // Group by what the key can actually do, so manage-capable fleets lead. Never filter:
  // probed grants are advisory and can't see write scopes, so hiding a fleet on a missing
  // grant would lock the user out of one they really can administer.
  const groups: { label: string; fleets: FleetOption[] }[] = [
    { label: 'Moderation / configuration', fleets: [] },
    { label: 'Access not probed', fleets: [] },
    { label: 'Read-only', fleets: [] }
  ]
  for (const f of sortByAccess(fleets, grants)) {
    const { tier } = fleetAccess(grants[f.id])
    groups[tier === 'admin' || tier === 'elevated' ? 0 : tier === 'unknown' ? 1 : 2].fleets.push(f)
  }

  return (
    <div className="flex items-center gap-2">
      <Pill
        lead={<Rocket size={13} className="text-[var(--accent)] shrink-0" />}
        value={fleetId ?? ''}
        onChange={(v) => selectFleet(v || null, fleets.find((f) => f.id === v)?.name ?? null)}
        width="max-w-[180px]"
      >
        <option value="">{fleets.length ? 'No fleet selected' : 'No fleets'}</option>
        {/* A remembered fleet the list hasn't loaded (or no longer returns) must still show. */}
        {fleetId && !current && <option value={fleetId}>{fleetName ?? fleetId}</option>}
        {groups
          .filter((g) => g.fleets.length > 0)
          .map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.fleets.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                  {fleetAccess(grants[f.id]).tier === 'admin' ? ' · admin' : ''}
                </option>
              ))}
            </optgroup>
          ))}
      </Pill>
      <Pill
        lead={<Server size={13} className="text-[var(--accent)] shrink-0" />}
        value={stationId ?? ''}
        onChange={(v) => selectStation(v || null, stations.find((s) => s.id === v)?.name ?? null)}
        width="max-w-[180px]"
      >
        <option value="">{stations.length ? 'No station selected' : 'No stations'}</option>
        {stationId && !stations.some((s) => s.id === stationId) && (
          <option value={stationId}>{stationName ?? stationId}</option>
        )}
        {stations.map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </Pill>
    </div>
  )
}

export function Layout({ children }: { children: ReactNode }) {
  const location = useLocation()
  const settings = useAppStore((s) => s.settings)
  useEffect(() => {
    document.documentElement.dataset.theme = settings?.theme ?? 'dark'
  }, [settings?.theme])
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
          {[...NAV, ...(settings?.dangerZone ? [DANGER_NAV] : [])].map((group) => (
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
          <img src={wordmark} alt="Orion Drift" className="w-full max-w-[140px] mx-auto opacity-90" />
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
          <div className="flex items-center gap-2 shrink-0">
            <ContextSwitcher />
            <KeySwitcher />
          </div>
        </header>
        <main key={location.pathname} className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
