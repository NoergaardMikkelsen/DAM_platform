/**
 * Error handling utilities
 * Provides consistent error handling and toast notifications across the application
 */

/**
 * Extract a user-friendly error message from an error object
 * @param error - The error object (can be Error, string, or unknown)
 * @returns A user-friendly error message
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  
  if (typeof error === "string") {
    return error
  }
  
  // Handle Supabase errors
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message)
  }
  
  return "An unexpected error occurred. Please try again."
}

/**
 * Handle an error and show an error toast notification
 * @param error - The error object (can be Error, string, or unknown)
 * @param toast - The toast function from useToast hook
 * @param options - Optional configuration
 * @param options.title - Custom error title (default: "Error")
 * @param options.description - Custom error description (overrides getErrorMessage)
 * @param options.logError - Whether to log the error to console (default: true)
 */
export function handleError(
  error: unknown,
  toast: ReturnType<typeof import("@/hooks/use-toast").useToast>["toast"],
  options?: {
    title?: string
    description?: string
    logError?: boolean
  }
): void {
  const { title = "Error", description, logError = true } = options || {}
  
  // Log error to console for debugging (unless disabled)
  if (logError) {
    console.error("Error:", error)
  }
  
  // Show error toast
  toast({
    title,
    description: description || getErrorMessage(error),
    variant: "destructive",
  })
}

/**
 * Handle a success operation and show a success toast notification
 * @param toast - The toast function from useToast hook
 * @param message - Success message
 * @param title - Optional success title (default: "Success")
 */
export function handleSuccess(
  toast: ReturnType<typeof import("@/hooks/use-toast").useToast>["toast"],
  message: string,
  title: string = "Success"
): void {
  toast({
    title,
    description: message,
  })
}

