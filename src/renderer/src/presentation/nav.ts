import {
  LayoutDashboard,
  Rocket,
  Radio,
  Server,
  Gamepad2,
  Image,
  Users,
  UserSearch,
  Shield,
  Gavel,
  Activity,
  History,
  Library,
  FileJson,
  Network,
  TerminalSquare,
  ScrollText,
  KeyRound,
  Settings,
  type LucideIcon
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
}

export interface NavGroup {
  title: string
  items: NavItem[]
}

export const NAV: NavGroup[] = [
  { title: 'Overview', items: [{ to: '/', label: 'Dashboard', icon: LayoutDashboard }] },
  {
    title: 'Fleet Ops',
    items: [
      { to: '/fleets', label: 'Fleet Explorer', icon: Rocket },
      { to: '/live', label: 'Live Ops', icon: Radio },
      { to: '/stations', label: 'Station Manager', icon: Server },
      { to: '/gamemodes', label: 'Gamemode Manager', icon: Gamepad2 },
      { to: '/board', label: 'Board Manager', icon: Image }
    ]
  },
  {
    title: 'Community',
    items: [
      { to: '/players', label: 'Player Manager', icon: Users },
      { to: '/lookup', label: 'Player Lookup', icon: UserSearch },
      { to: '/roles', label: 'Roles', icon: Shield },
      { to: '/moderation', label: 'Moderation', icon: Gavel }
    ]
  },
  {
    title: 'Activity',
    items: [
      { to: '/events', label: 'Server Events', icon: Activity },
      { to: '/matches', label: 'Match History', icon: History }
    ]
  },
  {
    title: 'Config',
    items: [
      { to: '/le-library', label: 'LE Config Library', icon: Library },
      { to: '/config', label: 'Config Editor', icon: FileJson }
    ]
  },
  {
    title: 'Developer',
    items: [
      { to: '/endpoints', label: 'Endpoint Explorer', icon: Network },
      { to: '/devmode', label: 'Dev Mode', icon: TerminalSquare },
      { to: '/logs', label: 'Logs', icon: ScrollText }
    ]
  },
  {
    title: 'System',
    items: [
      { to: '/keys', label: 'API Keys', icon: KeyRound },
      { to: '/settings', label: 'Settings', icon: Settings }
    ]
  }
]
