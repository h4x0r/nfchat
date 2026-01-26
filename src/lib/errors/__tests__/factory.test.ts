import { describe, it, expect } from 'vitest';
import {
  createError,
  Errors,
  isAppError,
  ErrorCodes,
  type AppError,
} from '../index';

describe('Error Factory', () => {
  describe('createError', () => {
    it('creates error with all required fields', () => {
      const error = createError({
        code: ErrorCodes.INTERNAL_ERROR,
        message: 'Something went wrong',
        category: 'internal',
      });

      expect(error.code).toBe(ErrorCodes.INTERNAL_ERROR);
      expect(error.message).toBe('Something went wrong');
      expect(error.category).toBe('internal');
    });

    it('generates unique correlationId for each error', () => {
      const error1 = createError({
        code: ErrorCodes.INTERNAL_ERROR,
        message: 'Error 1',
        category: 'internal',
      });
      const error2 = createError({
        code: ErrorCodes.INTERNAL_ERROR,
        message: 'Error 2',
        category: 'internal',
      });

      expect(error1.correlationId).toBeDefined();
      expect(error2.correlationId).toBeDefined();
      expect(error1.correlationId).not.toBe(error2.correlationId);
    });

    it('includes optional fields when provided', () => {
      const error = createError({
        code: ErrorCodes.VAL_MISSING_FIELD,
        message: 'Field is required',
        category: 'validation',
        details: 'The "email" field was not provided',
        recovery: 'Please provide a valid email address',
      });

      expect(error.details).toBe('The "email" field was not provided');
      expect(error.recovery).toBe('Please provide a valid email address');
    });

    it('preserves provided correlationId instead of generating new one', () => {
      const error = createError({
        code: ErrorCodes.INTERNAL_ERROR,
        message: 'Error with custom ID',
        category: 'internal',
        correlationId: 'custom-123',
      });

      expect(error.correlationId).toBe('custom-123');
    });
  });

  describe('Errors convenience factory', () => {
    it('creates validation error', () => {
      const error = Errors.validation('Invalid input');

      expect(error.category).toBe('validation');
      expect(error.code).toBe(ErrorCodes.VAL_MISSING_FIELD);
      expect(error.message).toBe('Invalid input');
    });

    it('creates validation error with custom code', () => {
      const error = Errors.validation('SQL not allowed', {
        code: ErrorCodes.VAL_SQL_FORBIDDEN,
      });

      expect(error.code).toBe(ErrorCodes.VAL_SQL_FORBIDDEN);
    });

    it('creates internal error', () => {
      const error = Errors.internal('Unexpected failure');

      expect(error.category).toBe('internal');
      expect(error.code).toBe(ErrorCodes.INTERNAL_ERROR);
      expect(error.message).toBe('Unexpected failure');
    });

    it('creates network error', () => {
      const error = Errors.network('Connection refused');

      expect(error.category).toBe('network');
      expect(error.code).toBe(ErrorCodes.NETWORK_ERROR);
      expect(error.message).toBe('Connection refused');
    });

    it('creates database error', () => {
      const error = Errors.database('Query failed');

      expect(error.category).toBe('internal');
      expect(error.code).toBe(ErrorCodes.DB_QUERY_FAILED);
      expect(error.message).toBe('Query failed');
    });

    it('passes through optional fields', () => {
      const error = Errors.validation('Missing field', {
        details: 'Field "name" is required',
        recovery: 'Add a name field to your request',
      });

      expect(error.details).toBe('Field "name" is required');
      expect(error.recovery).toBe('Add a name field to your request');
    });
  });

  describe('isAppError type guard', () => {
    it('returns true for valid AppError', () => {
      const error = createError({
        code: ErrorCodes.INTERNAL_ERROR,
        message: 'Test',
        category: 'internal',
      });

      expect(isAppError(error)).toBe(true);
    });

    it('returns false for plain Error', () => {
      const error = new Error('Plain error');

      expect(isAppError(error)).toBe(false);
    });

    it('returns false for null', () => {
      expect(isAppError(null)).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isAppError(undefined)).toBe(false);
    });

    it('returns false for partial object missing required fields', () => {
      expect(isAppError({ code: 'TEST', message: 'test' })).toBe(false);
      expect(isAppError({ code: 'TEST', category: 'internal' })).toBe(false);
      expect(isAppError({ message: 'test', category: 'internal' })).toBe(false);
    });

    it('returns false for object with wrong category type', () => {
      expect(
        isAppError({
          code: 'TEST',
          message: 'test',
          category: 'invalid-category',
        })
      ).toBe(false);
    });
  });

  describe('ErrorCodes', () => {
    it('has all expected error codes', () => {
      expect(ErrorCodes.VAL_MISSING_FIELD).toBe('VAL_MISSING_FIELD');
      expect(ErrorCodes.VAL_SQL_FORBIDDEN).toBe('VAL_SQL_FORBIDDEN');
      expect(ErrorCodes.DB_QUERY_FAILED).toBe('DB_QUERY_FAILED');
      expect(ErrorCodes.NETWORK_ERROR).toBe('NETWORK_ERROR');
      expect(ErrorCodes.INTERNAL_ERROR).toBe('INTERNAL_ERROR');
    });
  });
});
