import { LoadingScreen } from '@/components/ui/loading-screen'

export default function Loading() {
  return (
    <LoadingScreen
      messages={[
        "Loading collection details...",
        "Fetching asset information...",
        "Preparing collection view...",
        "Loading related content...",
        "Collection ready..."
      ]}
    />
  )
}
