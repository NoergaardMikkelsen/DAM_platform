export default function Loading() {
  return (
    <div className="p-8">
      {/* Header skeleton */}
      <div className="mb-8 flex items-center justify-between">
        <div className="h-9 w-48 bg-gray-200 rounded animate-pulse"></div>
        <div className="flex items-center gap-2">
          <div className="h-10 w-20 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-10 w-64 bg-gray-200 rounded animate-pulse"></div>
        </div>
      </div>

      {/* Collections section skeleton */}
      <div className="mb-10">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-6 w-32 bg-gray-200 rounded animate-pulse"></div>
            <div className="h-4 w-24 bg-gray-200 rounded animate-pulse"></div>
          </div>
          <div className="h-10 w-48 bg-gray-200 rounded animate-pulse"></div>
        </div>
        <div className="grid gap-8" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          {[...Array(3)].map((_, i) => (
            <div key={i} className="relative w-full min-w-[200px] aspect-[239/200] overflow-hidden">
              <svg viewBox="0 0 239 200" className="w-full h-full" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
                <defs>
                  <mask id={`skeletonMask-loading-${i}`} maskUnits="userSpaceOnUse" x="0" y="0" width="239" height="200">
                    <path
                      d="M0 179V21C0 9.40202 9.40202 0 21 0H216.195C227.67 0 237.02 9.17764 237.181 20.652C237.598 50.258 238.304 103.407 238.304 123.5C238.304 152 206.152 133 188.658 156C171.163 179 193.386 200 144.499 200H20.9761C9.37811 200 0 190.598 0 179Z"
                      fill="white"
                    />
                  </mask>
                </defs>
                <rect x="0" y="0" width="239" height="200" fill="#e5e7eb" mask={`url(#skeletonMask-loading-${i})`} className="animate-pulse" />
              </svg>
            </div>
          ))}
        </div>
      </div>

      {/* Assets section skeleton */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-6 w-24 bg-gray-200 rounded animate-pulse"></div>
            <div className="h-4 w-20 bg-gray-200 rounded animate-pulse"></div>
          </div>
          <div className="h-10 w-48 bg-gray-200 rounded animate-pulse"></div>
        </div>
        <div className="columns-2 md:columns-3 lg:columns-4 xl:columns-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="group overflow-hidden p-0 transition-shadow hover:shadow-lg mb-6 break-inside-avoid">
              <div className="relative bg-gradient-to-br from-gray-100 to-gray-200 animate-pulse" style={{ aspectRatio: '4/5' }}>
                <div className="absolute bottom-2 right-2 h-8 w-8 rounded-full bg-white/80 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
