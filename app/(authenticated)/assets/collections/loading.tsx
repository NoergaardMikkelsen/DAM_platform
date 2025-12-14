import { LoadingScreen } from '@/components/ui/loading-screen'

export default function Loading() {
  return (
    <LoadingScreen
      messages={[
        "Organizing your collections...",
        "Sorting by categories...",
        "Loading collection previews...",
        "Preparing asset groups...",
        "Collections ready..."
      ]}
    />
  )
}
