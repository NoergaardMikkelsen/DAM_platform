export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f5f6]">
      <div className="flex flex-col items-center gap-3 rounded-xl bg-white px-6 py-5 shadow-sm">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#DF475C] border-t-transparent" />
        <p className="text-sm text-gray-600">Loading asset…</p>
      </div>
    </div>
  )
}

