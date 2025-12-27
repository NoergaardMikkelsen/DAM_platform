/**
 * Slug generation utilities
 * Provides consistent slug generation across the application
 */

/**
 * Generate a URL-friendly slug from a text string
 * @param text - The text to convert to a slug
 * @returns A URL-friendly slug
 * 
 * @example
 * generateSlug("Hello World!") // "hello-world"
 * generateSlug("Test---Multiple---Dashes") // "test-multiple-dashes"
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

