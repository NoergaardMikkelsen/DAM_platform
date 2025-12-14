import { LoadingScreen } from '@/components/ui/loading-screen'

export default function Loading() {
  return (
    <LoadingScreen
      messages={[
        "Loading user management...",
        "Fetching user profiles...",
        "Loading permissions...",
        "Preparing user dashboard...",
        "Users ready..."
      ]}
    />
  )
}
