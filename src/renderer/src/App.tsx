import { useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { Layout } from './presentation/components/Layout'
import { useAppStore } from './state/useAppStore'
import { useLogStore } from './state/useLogStore'
import { useSelectionStore } from './state/useSelectionStore'
import { Spinner } from './presentation/components/ui'
import { NAV, DANGER_NAV } from './presentation/nav'
import { presenceFor } from './lib/discordPresence'
import { api } from './lib/api'

import DashboardPage from './presentation/pages/DashboardPage'
import FleetPage from './presentation/pages/FleetPage'
import StationPage from './presentation/pages/StationPage'
import GamemodePage from './presentation/pages/GamemodePage'
import BoardManagerPage from './presentation/pages/BoardManagerPage'
import PlayerPage from './presentation/pages/PlayerPage'
import PlayerLookupPage from './presentation/pages/PlayerLookupPage'
import RolesPage from './presentation/pages/RolesPage'
import ModerationPage from './presentation/pages/ModerationPage'
import EventsPage from './presentation/pages/EventsPage'
import MatchHistoryPage from './presentation/pages/MatchHistoryPage'
import LeLibraryPage from './presentation/pages/LeLibraryPage'
import LeCatalogPage from './presentation/pages/LeCatalogPage'
import ConfigEditorPage from './presentation/pages/ConfigEditorPage'
import EndpointExplorerPage from './presentation/pages/EndpointExplorerPage'
import DevModePage from './presentation/pages/DevModePage'
import LogsPage from './presentation/pages/LogsPage'
import KeysPage from './presentation/pages/KeysPage'
import DangerSystemPage from './presentation/pages/DangerSystemPage'
import SettingsPage from './presentation/pages/SettingsPage'

/** Push the current page + selection to Discord, filtered by the chosen privacy level. */
function useDiscordPresence(): void {
  const level = useAppStore((s) => s.settings?.discordPrivacy)
  const { pathname } = useLocation()
  const fleetName = useSelectionStore((s) => s.fleetName)
  const stationName = useSelectionStore((s) => s.stationName)

  useEffect(() => {
    if (!level) return
    const page =
      [...NAV, DANGER_NAV].flatMap((g) => g.items).find((i) => i.to === pathname)?.label ?? null
    void api.setPresence(presenceFor(level, { page, fleetName, stationName }))
  }, [level, pathname, fleetName, stationName])
}

export default function App() {
  const loaded = useAppStore((s) => s.loaded)
  const load = useAppStore((s) => s.load)
  const initLogs = useLogStore((s) => s.init)
  const hydrateSelection = useSelectionStore((s) => s.hydrate)

  useEffect(() => {
    void load()
    void initLogs()
    void hydrateSelection()
  }, [load, initLogs, hydrateSelection])

  useDiscordPresence()

  if (!loaded) {
    return (
      <div className="h-screen grid place-items-center">
        <Spinner label="Starting FleetView…" />
      </div>
    )
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/fleets" element={<FleetPage />} />
        <Route path="/stations" element={<StationPage />} />
        <Route path="/gamemodes" element={<GamemodePage />} />
        <Route path="/board" element={<BoardManagerPage />} />
        <Route path="/players" element={<PlayerPage />} />
        <Route path="/lookup" element={<PlayerLookupPage />} />
        <Route path="/roles" element={<RolesPage />} />
        <Route path="/moderation" element={<ModerationPage />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/matches" element={<MatchHistoryPage />} />
        <Route path="/le-library" element={<LeLibraryPage />} />
        <Route path="/le-catalog" element={<LeCatalogPage />} />
        <Route path="/config" element={<ConfigEditorPage />} />
        <Route path="/endpoints" element={<EndpointExplorerPage />} />
        <Route path="/devmode" element={<DevModePage />} />
        <Route path="/logs" element={<LogsPage />} />
        <Route path="/danger/system" element={<DangerSystemPage />} />
        <Route path="/keys" element={<KeysPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </Layout>
  )
}
