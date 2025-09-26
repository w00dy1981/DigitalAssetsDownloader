/**
 * Centralized constants for Digital Assets Downloader
 * Consolidates hardcoded values found throughout the codebase
 * Issue #23: Phase 6B - Configuration Enhancement
 */

// Network & Timeout Configuration
export const NETWORK_CONSTANTS = {
  // Default connection timeout (5 seconds)
  CONNECTION_TIMEOUT: 5000,

  // Default read timeout (30 seconds) - used across multiple services
  READ_TIMEOUT: 30000,

  // Auto-updater check timeout (30 seconds)
  UPDATE_CHECK_TIMEOUT: 30000,

  // Excel loading timeout (30 seconds)
  EXCEL_TIMEOUT: 30000,
} as const;

// Image Processing Configuration
export const IMAGE_PROCESSING_CONSTANTS = {
  // Default JPEG quality (95%) - used across services and components
  DEFAULT_QUALITY: 95,

  // Quality validation range
  MIN_QUALITY: 60,
  MAX_QUALITY: 100,

  // Default edge threshold for smart detection
  DEFAULT_EDGE_THRESHOLD: 30,
} as const;

// UI Configuration
export const UI_CONSTANTS = {
  // Default application window dimensions
  DEFAULT_WINDOW_WIDTH: 1200,
  DEFAULT_WINDOW_HEIGHT: 800,

  // Minimum window dimensions
  MIN_WINDOW_WIDTH: 800,
  MIN_WINDOW_HEIGHT: 600,

  // Status message display duration (8 seconds)
  STATUS_MESSAGE_DURATION: 8000,

  // Development vs production timeout for updates
  DEV_UPDATE_TIMEOUT: 10000,
  PROD_UPDATE_TIMEOUT: 30000,
} as const;

// Download Configuration
export const DOWNLOAD_CONSTANTS = {
  // Worker limits for concurrent downloads
  MIN_WORKERS: 1,
  MAX_WORKERS: 20,
  DEFAULT_WORKERS: 5,

  // Retry configuration
  DEFAULT_RETRY_ATTEMPTS: 3,
  MAX_RETRY_ATTEMPTS: 10,
} as const;

// File & Path Configuration
export const PATH_CONSTANTS = {
  // Auto-updater log file size limit (5MB)
  LOG_FILE_MAX_SIZE: 5 * 1024 * 1024,
} as const;

// Development/Production Environment Detection
export const ENV_CONSTANTS = {
  DEVELOPMENT: 'development',
  PRODUCTION: 'production',
} as const;

// Export consolidated constants for easy importing
export const CONSTANTS = {
  NETWORK: NETWORK_CONSTANTS,
  IMAGE: IMAGE_PROCESSING_CONSTANTS,
  UI: UI_CONSTANTS,
  DOWNLOAD: DOWNLOAD_CONSTANTS,
  PATH: PATH_CONSTANTS,
  ENV: ENV_CONSTANTS,
} as const;

// Type definitions for configuration values
export type NetworkTimeout =
  (typeof NETWORK_CONSTANTS)[keyof typeof NETWORK_CONSTANTS];
export type ImageQuality = number; // Between MIN_QUALITY and MAX_QUALITY
export type WindowDimension = number;
export type WorkerCount = number; // Between MIN_WORKERS and MAX_WORKERS
