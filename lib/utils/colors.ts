/**
 * Utility functions for working with colors
 */

/**
 * Converts a hex color to RGB values
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null
}

/**
 * Converts RGB values to hex color
 */
function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((x) => {
    const hex = x.toString(16)
    return hex.length === 1 ? `0${hex}` : hex
  }).join('')}`
}

/**
 * Darkens a hex color by a specified amount
 * @param hex - Hex color string (e.g., "#E55C6A")
 * @param amount - Amount to darken (0-255, default 20)
 * @returns Darkened hex color string
 */
export function darkenColor(hex: string, amount: number = 20): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex

  const darkerR = Math.max(0, rgb.r - amount)
  const darkerG = Math.max(0, rgb.g - amount)
  const darkerB = Math.max(0, rgb.b - amount)

  return rgbToHex(darkerR, darkerG, darkerB)
}

/**
 * Lightens a hex color by a specified amount
 * @param hex - Hex color string (e.g., "#E55C6A")
 * @param amount - Amount to lighten (0-255, default 20)
 * @returns Lightened hex color string
 */
export function lightenColor(hex: string, amount: number = 20): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex

  const lighterR = Math.min(255, rgb.r + amount)
  const lighterG = Math.min(255, rgb.g + amount)
  const lighterB = Math.min(255, rgb.b + amount)

  return rgbToHex(lighterR, lighterG, lighterB)
}

/**
 * Gets hover color for a primary color (darker version)
 * @param primaryColor - Primary color hex string
 * @param fallbackHover - Fallback hover color if primaryColor is not provided
 * @returns Hover color hex string
 */
export function getHoverColor(primaryColor: string | null | undefined, fallbackHover: string = '#000000'): string {
  if (!primaryColor) return fallbackHover
  return darkenColor(primaryColor, 20)
}
