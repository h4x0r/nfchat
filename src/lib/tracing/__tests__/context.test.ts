import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTraceContext, formatDuration, type TraceContext } from '../context';

describe('TraceContext', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('createTraceContext', () => {
    it('creates context with operation name', () => {
      const ctx = createTraceContext('loadData');

      expect(ctx.operation).toBe('loadData');
    });

    it('generates unique requestId', () => {
      const ctx1 = createTraceContext('op1');
      vi.advanceTimersByTime(1);
      const ctx2 = createTraceContext('op2');

      expect(ctx1.requestId).toBeDefined();
      expect(ctx2.requestId).toBeDefined();
      expect(ctx1.requestId).not.toBe(ctx2.requestId);
    });

    it('records start time', () => {
      const ctx = createTraceContext('operation');

      expect(ctx.startTime).toBeDefined();
      expect(typeof ctx.startTime).toBe('number');
    });

    it('requestId has expected format (timestamp-random)', () => {
      const ctx = createTraceContext('operation');

      // Format: base36timestamp-randomchars
      expect(ctx.requestId).toMatch(/^[a-z0-9]+-[a-z0-9]+$/);
    });
  });

  describe('formatDuration', () => {
    it('formats short duration in milliseconds', () => {
      expect(formatDuration(42)).toBe('42ms');
    });

    it('formats duration under a second', () => {
      expect(formatDuration(500)).toBe('500ms');
    });

    it('formats duration over a second', () => {
      expect(formatDuration(1500)).toBe('1.50s');
    });

    it('formats duration with decimal precision', () => {
      expect(formatDuration(2345)).toBe('2.35s');
    });

    it('formats long duration', () => {
      expect(formatDuration(60000)).toBe('60.00s');
    });
  });
});
