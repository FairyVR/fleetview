import { Construction } from 'lucide-react'
import { useAppStore } from '../../state/useAppStore'
import { PageHeader, Card } from '../components/ui'

export default function DangerSystemPage() {
  const dangerZone = useAppStore((s) => s.settings?.dangerZone)
  return (
    <div>
      <PageHeader title="System" subtitle="Danger Zone" />
      {!dangerZone ? (
        <Card className="max-w-xl">
          <div className="text-[13px]">The Danger Zone is disabled. Enable it in Settings.</div>
        </Card>
      ) : (
        <div className="grid place-items-center py-24 rounded-xl border-2 border-dashed border-[var(--warn)]/50 bg-[var(--warn)]/5">
          <Construction size={48} className="text-[var(--warn)] mb-4" />
          <div className="text-4xl font-bold tracking-widest text-[var(--warn)]">WIP</div>
          <div className="text-[13px] text-[var(--text-dim)] mt-2">
            Nothing lives in the Danger Zone yet.
          </div>
        </div>
      )}
    </div>
  )
}
