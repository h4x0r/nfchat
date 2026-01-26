/**
 * Zod schemas for API response validation.
 *
 * These schemas provide runtime validation for API responses,
 * catching malformed data early at the API boundary.
 */

import { z } from 'zod';

// ─────────────────────────────────────────────────────────────
// Dashboard Data Schema
// ─────────────────────────────────────────────────────────────

const timelineItemSchema = z.object({
  time: z.number(),
  attack: z.string(),
  count: z.number(),
});

const attackItemSchema = z.object({
  attack: z.string(),
  count: z.number(),
});

const ipValueSchema = z.object({
  ip: z.string(),
  value: z.number(),
});

// For dynamic record types, use z.object({}).passthrough() in Zod v4
const recordSchema = z.object({}).passthrough();

export const dashboardDataSchema = z.object({
  timeline: z.array(timelineItemSchema),
  attacks: z.array(attackItemSchema),
  topSrcIPs: z.array(ipValueSchema),
  topDstIPs: z.array(ipValueSchema),
  flows: z.array(recordSchema),
  totalCount: z.number(),
});

/**
 * Inferred TypeScript type from the schema.
 * Use this instead of manually defining the interface.
 */
export type DashboardData = z.infer<typeof dashboardDataSchema>;

// ─────────────────────────────────────────────────────────────
// Flows Response Schema
// ─────────────────────────────────────────────────────────────

export const flowsResponseSchema = z.object({
  flows: z.array(recordSchema),
  totalCount: z.number(),
});

export type FlowsResponse = z.infer<typeof flowsResponseSchema>;

// ─────────────────────────────────────────────────────────────
// Query Response Schema
// ─────────────────────────────────────────────────────────────

export const queryResponseSchema = z.array(recordSchema);

export type QueryResponse = z.infer<typeof queryResponseSchema>;

// ─────────────────────────────────────────────────────────────
// Chat Response Schemas
// ─────────────────────────────────────────────────────────────

export const chatQueryResponseSchema = z.object({
  queries: z.array(z.string()).optional().default([]),
  reasoning: z.string().optional(),
});

export type ChatQueryResponse = z.infer<typeof chatQueryResponseSchema>;

export const chatAnalyzeResponseSchema = z.object({
  response: z.string().optional(),
});

export type ChatAnalyzeResponse = z.infer<typeof chatAnalyzeResponseSchema>;

// ─────────────────────────────────────────────────────────────
// Validation Helpers
// ─────────────────────────────────────────────────────────────

/**
 * Validate dashboard data response.
 * @throws Error if validation fails
 */
export function validateDashboardData(data: unknown): DashboardData {
  const result = dashboardDataSchema.safeParse(data);
  if (!result.success) {
    const details = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid dashboard data: ${details}`);
  }
  return result.data;
}

/**
 * Validate flows response.
 * @throws Error if validation fails
 */
export function validateFlowsResponse(data: unknown): FlowsResponse {
  const result = flowsResponseSchema.safeParse(data);
  if (!result.success) {
    const details = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid flows response: ${details}`);
  }
  return result.data;
}

/**
 * Validate query response.
 * @throws Error if validation fails
 */
export function validateQueryResponse(data: unknown): QueryResponse {
  const result = queryResponseSchema.safeParse(data);
  if (!result.success) {
    const details = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid query response: ${details}`);
  }
  return result.data;
}
