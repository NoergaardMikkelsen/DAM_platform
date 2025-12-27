"use client"

interface PaginationControlsProps {
  currentPage: number
  totalPages: number
  goToPage: (page: number) => void
  nextPage: () => void
  prevPage: () => void
  isFirstPage: boolean
  isLastPage: boolean
  totalItems: number
  className?: string
}

/**
 * Reusable pagination controls component with fixed positioning
 * Matches the design used across all table pages
 */
export function PaginationControls({
  currentPage,
  totalPages,
  goToPage,
  nextPage,
  prevPage,
  isFirstPage,
  isLastPage,
  totalItems,
  className = "",
}: PaginationControlsProps) {
  if (totalItems === 0) {
    return null
  }

  return (
    <div className={`fixed bottom-8 right-8 flex items-center gap-4 z-10 ${className}`}>
      <button
        className="h-11 w-11 rounded-full bg-white border-[0.5px] border-black flex items-center justify-center hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        onClick={prevPage}
        disabled={isFirstPage}
      >
        <svg
          viewBox="0 8 25 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-4 h-4"
          style={{ transform: 'scaleX(-1)' }}
        >
          <path
            d="M5.37842 18H19.7208M19.7208 18L15.623 22.5M19.7208 18L15.623 13.5"
            stroke="black"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
          />
        </svg>
      </button>
      {totalPages > 1 ? (
        <div className="flex items-center gap-1 bg-[#E6E6E6] rounded-[30px] p-1">
          <button
            onClick={() => goToPage(1)}
            className={`flex items-center justify-center transition-all cursor-pointer ${
              currentPage === 1
                ? 'h-9 w-9 rounded-full bg-white text-gray-900'
                : 'h-8 w-8 rounded-md bg-transparent text-gray-600 hover:bg-gray-200'
            }`}
          >
            1
          </button>
          {totalPages > 2 && (
            <>
              {currentPage <= 2 ? (
                <button
                  onClick={() => goToPage(2)}
                  className={`flex items-center justify-center transition-all cursor-pointer ${
                    currentPage === 2
                      ? 'h-9 w-9 rounded-full bg-white text-gray-900'
                      : 'h-8 w-8 rounded-md bg-transparent text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  2
                </button>
              ) : (
                <>
                  {currentPage > 3 && (
                    <span className="h-8 w-8 flex items-center justify-center text-gray-400">...</span>
                  )}
                  <button
                    onClick={() => goToPage(currentPage)}
                    className="h-9 w-9 rounded-full bg-white text-gray-900 flex items-center justify-center cursor-pointer"
                  >
                    {currentPage}
                  </button>
                </>
              )}
              {totalPages > 3 && currentPage < totalPages && (
                <>
                  {currentPage < totalPages - 1 && (
                    <span className="h-8 w-8 flex items-center justify-center text-gray-400">...</span>
                  )}
                  <button
                    onClick={() => goToPage(totalPages)}
                    className={`flex items-center justify-center transition-all cursor-pointer ${
                      currentPage === totalPages
                        ? 'h-9 w-9 rounded-full bg-white text-gray-900'
                        : 'h-8 w-8 rounded-md bg-transparent text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {totalPages}
                  </button>
                </>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="h-9 w-9 rounded-full bg-white flex items-center justify-center text-gray-900">
          1
        </div>
      )}
      <button
        className="h-11 w-11 rounded-full bg-white border-[0.5px] border-black flex items-center justify-center hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        onClick={nextPage}
        disabled={isLastPage}
      >
        <svg
          viewBox="0 8 25 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-4 h-4"
        >
          <path
            d="M5.37842 18H19.7208M19.7208 18L15.623 22.5M19.7208 18L15.623 13.5"
            stroke="black"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
          />
        </svg>
      </button>
    </div>
  )
}

