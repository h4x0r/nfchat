/**
 * Error category determines handling strategy:
 * - validation: User-recoverable, show message to user
 * - internal: Log for debugging, show generic message
 * - network: Retryable, may auto-retry
 * - external: Third-party service failure
 */
export type ErrorCategory = 'validation' | 'internal' | 'network' | 'external';

/**
 * Structured error for consistent handling across the application.
 * All errors should be converted to this format before being thrown/returned.
 */
export interface AppError {
  /** Machine-readable error code (e.g., 'VAL_SQL_FORBIDDEN') */
  code: string;
  /** User-safe error message */
  message: string;
  /** Error category for routing handling logic */
  category: ErrorCategory;
  /** Technical details for logging (not shown to user) */
  details?: string;
  /** Unique ID for tracing this error across systems */
  correlationId?: string;
  /** Suggested recovery action for the user */
  recovery?: string;
}

/**
 * Standard error codes used across the application.
 * Add new codes here as needed.
 */
export const ErrorCodes = {
  // Validation errors (4xx)
  VAL_MISSING_FIELD: 'VAL_MISSING_FIELD',
  VAL_SQL_FORBIDDEN: 'VAL_SQL_FORBIDDEN',
  VAL_INVALID_FORMAT: 'VAL_INVALID_FORMAT',

  // Database errors
  DB_QUERY_FAILED: 'DB_QUERY_FAILED',
  DB_CONNECTION_FAILED: 'DB_CONNECTION_FAILED',

  // Network errors
  NETWORK_ERROR: 'NETWORK_ERROR',
  NETWORK_TIMEOUT: 'NETWORK_TIMEOUT',

  // Internal errors (5xx)
  INTERNAL_ERROR: 'INTERNAL_ERROR',

  // External service errors
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/**
 * Valid error categories for type guard validation
 */
export const VALID_CATEGORIES: ErrorCategory[] = [
  'validation',
  'internal',
  'network',
  'external',
];
