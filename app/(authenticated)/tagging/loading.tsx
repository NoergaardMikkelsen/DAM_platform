import { LoadingScreen } from '@/components/ui/loading-screen'

export default function Loading() {
  return (
    <LoadingScreen
      messages={[
        "Preparing tagging interface...",
        "Loading tag categories...",
        "Setting up tagging tools...",
        "Preparing smart suggestions...",
        "Tagging ready..."
      ]}
    />
  )
}
