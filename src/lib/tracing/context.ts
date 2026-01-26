/**
 * Request tracing context for debugging and correlation.
 *
 * Each request gets a unique ID that can be traced across:
 * - Frontend logs
 * - HTTP headers (X-Request-ID)
 * - Backend logs
 */

/**
 * Context for tracing a single request/operation.
 */
export interface TraceContext {
  /** Unique identifier for this request */
  requestId: string;
  /** Human-readable operation name (e.g., "loadFlows", "chat") */
  operation: string;
  /** Start time in milliseconds (from performance.now()) */
  startTime: number;
}

/**
 * Generate a unique request ID.
 * Format: base36timestamp-randomchars (e.g., "lxk2m3-abc12")
 */
function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 7);
  return `${timestamp}-${random}`;
}

/**
 * Create a new trace context for an operation.
 *
 * @param operation - Human-readable name for the operation
 * @returns TraceContext with unique ID and start time
 *
 * @example
 * const ctx = createTraceContext('loadFlows');
 * console.log(ctx.requestId); // "lxk2m3-abc12"
 */
export function createTraceContext(operation: string): TraceContext {
  return {
    requestId: generateRequestId(),
    operation,
    startTime: performance.now(),
  };
}

/**
 * Format a duration in milliseconds for display.
 *
 * @param ms - Duration in milliseconds
 * @returns Formatted string (e.g., "42ms" or "1.50s")
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Calculate elapsed time from a trace context.
 *
 * @param ctx - Trace context with start time
 * @returns Elapsed time in milliseconds
 */
export function getElapsedTime(ctx: TraceContext): number {
  return performance.now() - ctx.startTime;
}
