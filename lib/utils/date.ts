/**
 * Date formatting utilities
 * Provides consistent date formatting across the application
 */

export const DATE_FORMATS = {
  short: { day: "numeric", month: "short", year: "numeric" },
  long: { day: "numeric", month: "long", year: "numeric" },
  withTime: { 
    day: "numeric", 
    month: "short", 
    year: "numeric", 
    hour: "2-digit", 
    minute: "2-digit" 
  },
} as const

export type DateFormat = keyof typeof DATE_FORMATS

/**
 * Format a date string or Date object to a localized string
 * @param date - Date string or Date object
 * @param format - Format type (short, long, withTime)
 * @returns Formatted date string
 */
export function formatDate(date: string | Date, format: DateFormat = "short"): string {
  return new Date(date).toLocaleDateString("en-GB", DATE_FORMATS[format])
}

