export default function Loading() {
  return (
    <div className="p-8">
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-transparent" />
          <p className="text-gray-600">Loading clients...</p>
        </div>
      </div>
    </div>
  )
}
