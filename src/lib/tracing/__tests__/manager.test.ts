import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RequestManager, createRequestManager } from '../manager';

describe('RequestManager', () => {
  let manager: RequestManager;

  beforeEach(() => {
    vi.useFakeTimers();
    manager = createRequestManager();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('start', () => {
    it('creates a new request with trace context', () => {
      const { trace, signal } = manager.start('loadFlows', 'loadFlows');

      expect(trace).toBeDefined();
      expect(trace.operation).toBe('loadFlows');
      expect(trace.requestId).toBeDefined();
      expect(signal).toBeInstanceOf(AbortSignal);
    });

    it('returns an AbortSignal that is not aborted initially', () => {
      const { signal } = manager.start('loadFlows', 'loadFlows');

      expect(signal.aborted).toBe(false);
    });

    it('tracks request as pending', () => {
      manager.start('loadFlows', 'loadFlows');

      expect(manager.isPending('loadFlows')).toBe(true);
    });
  });

  describe('race condition handling', () => {
    it('cancels previous request when new one starts with same key', () => {
      const first = manager.start('loadFlows', 'loadFlows');
      const second = manager.start('loadFlows', 'loadFlows');

      // First request should be aborted
      expect(first.signal.aborted).toBe(true);
      // Second request should not be aborted
      expect(second.signal.aborted).toBe(false);
    });

    it('allows concurrent requests with different keys', () => {
      const flows = manager.start('loadFlows', 'loadFlows');
      const dashboard = manager.start('loadDashboard', 'loadDashboard');

      expect(flows.signal.aborted).toBe(false);
      expect(dashboard.signal.aborted).toBe(false);
    });

    it('tracks multiple request cancellations', () => {
      manager.start('loadFlows', 'loadFlows');
      manager.start('loadFlows', 'loadFlows');
      manager.start('loadFlows', 'loadFlows');

      // Only the last request should be pending
      expect(manager.isPending('loadFlows')).toBe(true);
    });
  });

  describe('complete', () => {
    it('marks request as no longer pending', () => {
      const { trace } = manager.start('loadFlows', 'loadFlows');
      manager.complete('loadFlows', trace.requestId);

      expect(manager.isPending('loadFlows')).toBe(false);
    });

    it('returns true if request was still active', () => {
      const { trace } = manager.start('loadFlows', 'loadFlows');
      const wasActive = manager.complete('loadFlows', trace.requestId);

      expect(wasActive).toBe(true);
    });

    it('returns false if request was superseded', () => {
      const first = manager.start('loadFlows', 'loadFlows');
      manager.start('loadFlows', 'loadFlows'); // Supersedes first

      // Try to complete the first request
      const wasActive = manager.complete('loadFlows', first.trace.requestId);

      expect(wasActive).toBe(false);
    });

    it('returns false if request key does not exist', () => {
      const wasActive = manager.complete('nonexistent', 'req-123');

      expect(wasActive).toBe(false);
    });
  });

  describe('cancel', () => {
    it('aborts the request signal', () => {
      const { signal } = manager.start('loadFlows', 'loadFlows');
      manager.cancel('loadFlows');

      expect(signal.aborted).toBe(true);
    });

    it('marks request as no longer pending', () => {
      manager.start('loadFlows', 'loadFlows');
      manager.cancel('loadFlows');

      expect(manager.isPending('loadFlows')).toBe(false);
    });

    it('does nothing if key does not exist', () => {
      // Should not throw
      expect(() => manager.cancel('nonexistent')).not.toThrow();
    });
  });

  describe('cancelAll', () => {
    it('cancels all pending requests', () => {
      const flows = manager.start('loadFlows', 'loadFlows');
      const dashboard = manager.start('loadDashboard', 'loadDashboard');

      manager.cancelAll();

      expect(flows.signal.aborted).toBe(true);
      expect(dashboard.signal.aborted).toBe(true);
      expect(manager.isPending('loadFlows')).toBe(false);
      expect(manager.isPending('loadDashboard')).toBe(false);
    });
  });

  describe('getPendingCount', () => {
    it('returns 0 when no requests pending', () => {
      expect(manager.getPendingCount()).toBe(0);
    });

    it('returns count of pending requests', () => {
      manager.start('loadFlows', 'loadFlows');
      manager.start('loadDashboard', 'loadDashboard');

      expect(manager.getPendingCount()).toBe(2);
    });

    it('decrements when request completes', () => {
      const { trace } = manager.start('loadFlows', 'loadFlows');
      manager.start('loadDashboard', 'loadDashboard');

      manager.complete('loadFlows', trace.requestId);

      expect(manager.getPendingCount()).toBe(1);
    });
  });
});
