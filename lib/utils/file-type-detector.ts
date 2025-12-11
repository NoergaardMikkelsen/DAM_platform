/**
 * Detects file type tag slug from MIME type
 * @param mimeType - The MIME type of the file (e.g., "image/jpeg", "video/mp4")
 * @returns The file type tag slug or null if no match
 */
export function getFileTypeFromMimeType(mimeType: string): string | null {
  if (!mimeType) return null

  const normalizedMimeType = mimeType.toLowerCase().trim()

  // Image types
  if (normalizedMimeType.startsWith("image/")) {
    // SVG and icon formats are treated as icons
    if (
      normalizedMimeType === "image/svg+xml" ||
      normalizedMimeType === "image/x-icon" ||
      normalizedMimeType === "image/vnd.microsoft.icon"
    ) {
      return "icon"
    }
    return "image"
  }

  // Video types
  if (normalizedMimeType.startsWith("video/")) {
    return "video"
  }

  // PDF
  if (normalizedMimeType === "application/pdf") {
    return "pdf"
  }

  // Font types
  if (
    normalizedMimeType.startsWith("font/") ||
    normalizedMimeType.startsWith("application/font") ||
    normalizedMimeType === "application/x-font-ttf" ||
    normalizedMimeType === "application/x-font-truetype" ||
    normalizedMimeType === "application/x-font-opentype" ||
    normalizedMimeType === "application/vnd.ms-fontobject" ||
    normalizedMimeType === "application/font-woff" ||
    normalizedMimeType === "application/font-woff2"
  ) {
    return "font"
  }

  // Document types
  if (
    normalizedMimeType === "application/msword" ||
    normalizedMimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    normalizedMimeType === "application/vnd.ms-excel" ||
    normalizedMimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    normalizedMimeType === "application/vnd.ms-powerpoint" ||
    normalizedMimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    normalizedMimeType === "application/vnd.oasis.opendocument.text" ||
    normalizedMimeType === "application/vnd.oasis.opendocument.spreadsheet" ||
    normalizedMimeType === "application/vnd.oasis.opendocument.presentation" ||
    normalizedMimeType === "application/rtf" ||
    normalizedMimeType === "text/plain" ||
    normalizedMimeType === "text/csv"
  ) {
    return "document"
  }

  // Icon types (additional checks)
  if (
    normalizedMimeType === "image/x-ico" ||
    normalizedMimeType === "image/ico" ||
    normalizedMimeType === "image/icon"
  ) {
    return "icon"
  }

  return null
}

