/**
 * Request Manager for handling concurrent requests and race conditions.
 *
 * When multiple requests are made for the same key (e.g., rapid filter changes),
 * only the most recent request should "win". Earlier requests are automatically
 * cancelled via AbortController.
 */

import { createTraceContext, type TraceContext } from './context';

interface PendingRequest {
  /** Unique ID of this request */
  id: string;
  /** AbortController to cancel this request */
  controller: AbortController;
}

export interface RequestManager {
  /**
   * Start a new request, cancelling any previous request with the same key.
   *
   * @param key - Unique key for this request type (e.g., "loadFlows")
   * @param operation - Human-readable operation name for tracing
   * @returns Object with AbortSignal for fetch and TraceContext for logging
   */
  start(key: string, operation: string): { signal: AbortSignal; trace: TraceContext };

  /**
   * Mark a request as complete.
   *
   * @param key - Request key
   * @param requestId - ID from the TraceContext
   * @returns true if this was still the active request, false if superseded
   */
  complete(key: string, requestId: string): boolean;

  /**
   * Manually cancel a pending request.
   *
   * @param key - Request key to cancel
   */
  cancel(key: string): void;

  /**
   * Cancel all pending requests.
   * Useful for cleanup on unmount.
   */
  cancelAll(): void;

  /**
   * Check if a request is pending.
   *
   * @param key - Request key
   */
  isPending(key: string): boolean;

  /**
   * Get the count of pending requests.
   */
  getPendingCount(): number;
}

/**
 * Create a new RequestManager instance.
 *
 * @example
 * const manager = createRequestManager();
 *
 * async function loadFlows() {
 *   const { signal, trace } = manager.start('loadFlows', 'loadFlows');
 *
 *   try {
 *     const response = await fetch('/api/flows', { signal });
 *     const data = await response.json();
 *
 *     // Check if this request is still relevant
 *     if (manager.complete('loadFlows', trace.requestId)) {
 *       setState(data);
 *     }
 *   } catch (err) {
 *     if (err.name === 'AbortError') {
 *       // Request was superseded, ignore
 *       return;
 *     }
 *     throw err;
 *   }
 * }
 */
export function createRequestManager(): RequestManager {
  const pending = new Map<string, PendingRequest>();

  return {
    start(key: string, operation: string) {
      // Cancel any existing request with this key
      const existing = pending.get(key);
      if (existing) {
        existing.controller.abort();
      }

      // Create new request
      const trace = createTraceContext(operation);
      const controller = new AbortController();

      pending.set(key, {
        id: trace.requestId,
        controller,
      });

      return {
        signal: controller.signal,
        trace,
      };
    },

    complete(key: string, requestId: string): boolean {
      const current = pending.get(key);

      // If no pending request or different ID, this request was superseded
      if (!current || current.id !== requestId) {
        return false;
      }

      // Remove from pending
      pending.delete(key);
      return true;
    },

    cancel(key: string): void {
      const existing = pending.get(key);
      if (existing) {
        existing.controller.abort();
        pending.delete(key);
      }
    },

    cancelAll(): void {
      for (const request of pending.values()) {
        request.controller.abort();
      }
      pending.clear();
    },

    isPending(key: string): boolean {
      return pending.has(key);
    },

    getPendingCount(): number {
      return pending.size;
    },
  };
}

/**
 * Global request manager singleton.
 * Use this for application-wide request tracking.
 */
export const requestManager = createRequestManager();
