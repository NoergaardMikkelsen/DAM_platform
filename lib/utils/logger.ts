/**
 * Logging utility
 * Provides consistent logging with environment-aware behavior
 */

const isDevelopment = process.env.NODE_ENV === 'development'

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

/**
 * Log a debug message (only in development)
 */
export function logDebug(...args: unknown[]): void {
  if (isDevelopment) {
    console.log('[DEBUG]', ...args)
  }
}

/**
 * Log an info message (only in development)
 */
export function logInfo(...args: unknown[]): void {
  if (isDevelopment) {
    console.log('[INFO]', ...args)
  }
}

/**
 * Log a warning message
 */
export function logWarn(...args: unknown[]): void {
  if (isDevelopment) {
    console.warn('[WARN]', ...args)
  }
}

/**
 * Log an error message (always logged, even in production)
 */
export function logError(...args: unknown[]): void {
  console.error('[ERROR]', ...args)
  // In production, you might want to send this to an error tracking service
  // if (process.env.NODE_ENV === 'production') {
  //   // Send to error tracking service
  // }
}

