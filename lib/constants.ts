/**
 * Application constants
 * Centralized location for all hardcoded values and configuration
 */

export const STORAGE_LIMITS = {
  /** Default storage limit per client in GB */
  DEFAULT_GB: 10,
  /** Maximum file size in MB */
  MAX_FILE_SIZE_MB: 100,
  /** Maximum storage per client in GB */
  MAX_STORAGE_PER_CLIENT_GB: 1000,
  /** Minimum storage per client in GB */
  MIN_STORAGE_PER_CLIENT_GB: 1,
  /** Bytes per MB */
  BYTES_PER_MB: 1024 * 1024,
  /** Bytes per GB */
  BYTES_PER_GB: 1024 * 1024 * 1024,
} as const

export const PAGINATION = {
  /** Default items per page */
  DEFAULT_ITEMS_PER_PAGE: 10,
  /** Minimum items per page */
  MIN_ITEMS_PER_PAGE: 3,
  /** Default fixed height overhead in pixels for viewport calculation */
  DEFAULT_FIXED_HEIGHT: 404, // Header(80) + Search(50) + Tabs(50) + Table header(60) + Padding(64) + Pagination(60) + Margin(40)
  /** Default row height in pixels */
  DEFAULT_ROW_HEIGHT: 60,
} as const

export const DEFAULT_COLORS = {
  PRIMARY: '#DF475C',
  SECONDARY: '#6c757d',
} as const

export const DEFAULT_ROLES = {
  SUPERADMIN: 'superadmin',
  ADMIN: 'admin',
  USER: 'user',
} as const

