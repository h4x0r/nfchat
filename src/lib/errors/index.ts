/**
 * Error types and utilities for consistent error handling.
 *
 * @example
 * ```ts
 * import { Errors, isAppError } from '@/lib/errors';
 *
 * // Create errors using convenience factory
 * throw Errors.validation('Email is required');
 * throw Errors.internal('Unexpected failure');
 *
 * // Check if unknown error is an AppError
 * if (isAppError(error)) {
 *   logger.error('App error', { correlationId: error.correlationId });
 * }
 * ```
 */

export { type AppError, type ErrorCategory, type ErrorCode, ErrorCodes, VALID_CATEGORIES } from './types';
export { createError, isAppError, Errors, type CreateErrorInput } from './factory';
