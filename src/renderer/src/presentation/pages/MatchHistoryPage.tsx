import { useNavigate } from 'react-router-dom'
import { PageHeader, Button, EmptyState } from '../components/ui'
import { Database } from 'lucide-react'

export default function MatchHistoryPage() {
  const navigate = useNavigate()

  return (
    <div>
      <PageHeader
        title="Match History"
        subtitle="Historical match data is not exposed by the Orion Drift API."
      />
      <EmptyState
        icon={<Database size={22} />}
        title="Match history isn't exposed by this API"
        hint="The Orion Drift dashboard API does not provide a matches endpoint. To track gameplay events, use the Server Events module instead."
        action={
          <Button variant="primary" onClick={() => navigate('/events')}>
            Go to Server Events
          </Button>
        }
      />
    </div>
  )
}
