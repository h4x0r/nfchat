import {
  type AppError,
  type ErrorCategory,
  ErrorCodes,
  VALID_CATEGORIES,
} from './types';

/**
 * Generate a unique correlation ID for error tracking.
 * Format: timestamp-randomString (e.g., "lxk2m3-abc12")
 */
function generateCorrelationId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 7);
  return `${timestamp}-${random}`;
}

/**
 * Input for creating an AppError
 */
export interface CreateErrorInput {
  code: string;
  message: string;
  category: ErrorCategory;
  details?: string;
  correlationId?: string;
  recovery?: string;
}

/**
 * Create a structured AppError with automatic correlation ID generation.
 */
export function createError(input: CreateErrorInput): AppError {
  return {
    code: input.code,
    message: input.message,
    category: input.category,
    details: input.details,
    correlationId: input.correlationId ?? generateCorrelationId(),
    recovery: input.recovery,
  };
}

/**
 * Type guard to check if a value is a valid AppError
 */
export function isAppError(value: unknown): value is AppError {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value !== 'object') {
    return false;
  }

  const obj = value as Record<string, unknown>;

  // Check required fields exist and have correct types
  if (typeof obj.code !== 'string') {
    return false;
  }

  if (typeof obj.message !== 'string') {
    return false;
  }

  if (typeof obj.category !== 'string') {
    return false;
  }

  // Check category is valid
  if (!VALID_CATEGORIES.includes(obj.category as ErrorCategory)) {
    return false;
  }

  return true;
}

/**
 * Optional fields for convenience factory methods
 */
interface ErrorOptions {
  code?: string;
  details?: string;
  recovery?: string;
  correlationId?: string;
}

/**
 * Convenience factory for common error types.
 * Use these instead of createError for common cases.
 */
export const Errors = {
  /**
   * Create a validation error (user input problem)
   */
  validation(message: string, options?: ErrorOptions): AppError {
    return createError({
      code: options?.code ?? ErrorCodes.VAL_MISSING_FIELD,
      message,
      category: 'validation',
      details: options?.details,
      recovery: options?.recovery,
      correlationId: options?.correlationId,
    });
  },

  /**
   * Create an internal error (server-side problem)
   */
  internal(message: string, options?: ErrorOptions): AppError {
    return createError({
      code: options?.code ?? ErrorCodes.INTERNAL_ERROR,
      message,
      category: 'internal',
      details: options?.details,
      recovery: options?.recovery,
      correlationId: options?.correlationId,
    });
  },

  /**
   * Create a network error (connectivity problem)
   */
  network(message: string, options?: ErrorOptions): AppError {
    return createError({
      code: options?.code ?? ErrorCodes.NETWORK_ERROR,
      message,
      category: 'network',
      details: options?.details,
      recovery: options?.recovery,
      correlationId: options?.correlationId,
    });
  },

  /**
   * Create a database error
   */
  database(message: string, options?: ErrorOptions): AppError {
    return createError({
      code: options?.code ?? ErrorCodes.DB_QUERY_FAILED,
      message,
      category: 'internal',
      details: options?.details,
      recovery: options?.recovery,
      correlationId: options?.correlationId,
    });
  },

  /**
   * Create an external service error
   */
  external(message: string, options?: ErrorOptions): AppError {
    return createError({
      code: options?.code ?? ErrorCodes.EXTERNAL_SERVICE_ERROR,
      message,
      category: 'external',
      details: options?.details,
      recovery: options?.recovery,
      correlationId: options?.correlationId,
    });
  },
};
