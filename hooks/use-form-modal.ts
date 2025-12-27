import { useState, useCallback } from "react"

interface UseFormModalOptions {
  /**
   * Callback to reset form fields when modal closes
   */
  onReset?: () => void
  /**
   * Callback when form is successfully submitted
   */
  onSuccess?: () => void
}

interface UseFormModalReturn {
  /**
   * Error message state
   */
  error: string | null
  /**
   * Set error message
   */
  setError: (error: string | null) => void
  /**
   * Loading state
   */
  isLoading: boolean
  /**
   * Set loading state
   */
  setIsLoading: (loading: boolean) => void
  /**
   * Handle form submission with error handling
   */
  handleSubmit: (submitFn: () => Promise<void>) => Promise<void>
  /**
   * Handle modal open/close with form reset
   */
  handleOpenChange: (open: boolean, onOpenChange: (open: boolean) => void) => void
  /**
   * Reset form and close modal
   */
  resetAndClose: (onOpenChange: (open: boolean) => void) => void
}

/**
 * Hook for managing form modal state including error handling, loading state, and form reset
 * 
 * @example
 * ```tsx
 * const { error, isLoading, handleSubmit, handleOpenChange } = useFormModal({
 *   onReset: () => {
 *     setEmail("")
 *     setPassword("")
 *   },
 *   onSuccess: () => {
 *     onSuccess?.()
 *   }
 * })
 * ```
 */
export function useFormModal({
  onReset,
  onSuccess,
}: UseFormModalOptions = {}): UseFormModalReturn {
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = useCallback(
    async (submitFn: () => Promise<void>) => {
      setIsLoading(true)
      setError(null)

      try {
        await submitFn()
        onSuccess?.()
      } catch (error: unknown) {
        setError(error instanceof Error ? error.message : "An error occurred")
      } finally {
        setIsLoading(false)
      }
    },
    [onSuccess]
  )

  const handleOpenChange = useCallback(
    (open: boolean, onOpenChange: (open: boolean) => void) => {
      if (!open && onReset) {
        onReset()
        setError(null)
      }
      onOpenChange(open)
    },
    [onReset]
  )

  const resetAndClose = useCallback(
    (onOpenChange: (open: boolean) => void) => {
      if (onReset) {
        onReset()
      }
      setError(null)
      onOpenChange(false)
    },
    [onReset]
  )

  return {
    error,
    setError,
    isLoading,
    setIsLoading,
    handleSubmit,
    handleOpenChange,
    resetAndClose,
  }
}

