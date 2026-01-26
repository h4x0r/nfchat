/**
 * Request tracing utilities for debugging and race condition handling.
 *
 * @example
 * ```ts
 * import { requestManager, createTraceContext } from '@/lib/tracing';
 *
 * // Option 1: Use RequestManager for automatic race condition handling
 * const { signal, trace } = requestManager.start('loadFlows', 'loadFlows');
 * const response = await fetch('/api/flows', { signal });
 *
 * // Option 2: Create standalone trace context
 * const ctx = createTraceContext('oneTimeOperation');
 * logger.info('Starting', { requestId: ctx.requestId });
 * ```
 */

export {
  createTraceContext,
  formatDuration,
  getElapsedTime,
  type TraceContext,
} from './context';

export {
  createRequestManager,
  requestManager,
  type RequestManager,
} from './manager';
