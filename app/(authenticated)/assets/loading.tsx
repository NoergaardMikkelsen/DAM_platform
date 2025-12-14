import { LoadingScreen } from '@/components/ui/loading-screen'

export default function Loading() {
  return (
    <LoadingScreen
      messages={[
        "Scanning your asset library...",
        "Indexing digital files...",
        "Loading metadata...",
        "Preparing thumbnails...",
        "Almost ready to browse..."
      ]}
    />
  )
}
