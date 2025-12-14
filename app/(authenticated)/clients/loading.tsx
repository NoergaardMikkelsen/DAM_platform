import { LoadingScreen } from '@/components/ui/loading-screen'

export default function Loading() {
  return (
    <LoadingScreen
      messages={[
        "Loading client information...",
        "Fetching client profiles...",
        "Preparing client dashboard...",
        "Loading permissions...",
        "Clients ready..."
      ]}
    />
  )
}
