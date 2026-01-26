/**
 * Zod schemas for runtime validation.
 *
 * @example
 * ```ts
 * import { validateDashboardData } from '@/lib/schemas';
 *
 * const data = await fetch('/api/dashboard').then(r => r.json());
 * const validated = validateDashboardData(data); // throws if invalid
 * ```
 */

export {
  // Schemas
  dashboardDataSchema,
  flowsResponseSchema,
  queryResponseSchema,
  chatQueryResponseSchema,
  chatAnalyzeResponseSchema,
  // Validators
  validateDashboardData,
  validateFlowsResponse,
  validateQueryResponse,
  // Types
  type DashboardData,
  type FlowsResponse,
  type QueryResponse,
  type ChatQueryResponse,
  type ChatAnalyzeResponse,
} from './responses';
