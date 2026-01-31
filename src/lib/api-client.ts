/**
 * Frontend API Client for MotherDuck Operations
 *
 * Calls backend API endpoints instead of connecting directly to MotherDuck.
 * This keeps the token secure on the server side.
 *
 * Features:
 * - Structured error handling with AppError
 * - Request tracing with X-Request-ID headers
 * - Retry detection for network errors
 */

import type { DashboardData } from '@/api/routes/motherduck'
import type { ProgressCallback, LogCallback } from './progress'
import { type AppError, Errors, isAppError } from './errors'
import { createTraceContext, type TraceContext } from './tracing'
import { logger } from './logger'

const apiLogger = logger.child('API')

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface LoadDataOptions {
  onProgress?: ProgressCallback
  onLog?: LogCallback
}

interface LoadResponse {
  success: boolean
  rowCount?: number
  error?: string | AppError
}

interface DashboardResponse {
  success: boolean
  data?: DashboardData
  error?: string | AppError
}

interface FlowsResponse {
  success: boolean
  data?: {
    flows: Record<string, unknown>[]
    totalCount: number
  }
  error?: string | AppError
}

interface QueryResponse {
  success: boolean
  data?: Record<string, unknown>[]
  error?: string | AppError
}

interface ChatQueryResponse {
  success: boolean
  queries?: string[]
  reasoning?: string
  error?: string | AppError
}

interface ChatAnalyzeResponse {
  success: boolean
  response?: string
  error?: string | AppError
}

// ─────────────────────────────────────────────────────────────
// ApiError Class
// ─────────────────────────────────────────────────────────────

/**
 * API error with structured error information.
 * Wraps an AppError with additional context.
 */
export class ApiError extends Error {
  public readonly appError: AppError

  constructor(appError: AppError) {
    super(appError.message)
    this.name = 'ApiError'
    this.appError = appError
  }

  /**
   * Whether this error might succeed if retried.
   * True for network and external service errors.
   */
  get isRetryable(): boolean {
    return ['network', 'external'].includes(this.appError.category)
  }
}

/**
 * Type guard for ApiError
 */
export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError
}

// ─────────────────────────────────────────────────────────────
// Error Parsing
// ─────────────────────────────────────────────────────────────

/**
 * Parse error from API response, handling both legacy (string) and structured (AppError) formats.
 */
function parseError(error: unknown, status: number, correlationId: string): AppError {
  // If already a structured AppError, use it
  if (isAppError(error)) {
    return { ...error, correlationId: error.correlationId ?? correlationId }
  }

  // Legacy string error - wrap in AppError
  const message = typeof error === 'string' ? error : 'Request failed'
  const category = status >= 500 ? 'internal' : 'validation'

  return {
    code: status >= 500 ? 'INTERNAL_ERROR' : 'VALIDATION_ERROR',
    message,
    category,
    correlationId,
  }
}

// ─────────────────────────────────────────────────────────────
// Request Deduplication
// ─────────────────────────────────────────────────────────────

/**
 * Cache of in-flight requests to prevent duplicate concurrent calls.
 * Key: endpoint + JSON body, Value: Promise of result
 */
const inFlightRequests = new Map<string, Promise<unknown>>()

/**
 * Create a unique key for request deduplication.
 */
function createRequestKey(endpoint: string, body: Record<string, unknown>): string {
  return `${endpoint}:${JSON.stringify(body)}`
}

// ─────────────────────────────────────────────────────────────
// Helper
// ─────────────────────────────────────────────────────────────

async function apiPost<T>(
  endpoint: string,
  body: Record<string, unknown>,
  trace?: TraceContext
): Promise<T> {
  // Check for duplicate in-flight request
  const requestKey = createRequestKey(endpoint, body)
  const existingRequest = inFlightRequests.get(requestKey)
  if (existingRequest) {
    apiLogger.debug('Deduplicating request', { endpoint })
    return existingRequest as Promise<T>
  }

  const ctx = trace ?? createTraceContext(`POST:${endpoint}`)

  apiLogger.debug('Request', { requestId: ctx.requestId, endpoint })

  // Create the request promise
  const requestPromise = (async () => {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': ctx.requestId,
        },
        body: JSON.stringify(body),
      })

      const data = await response.json()
      const elapsed = performance.now() - ctx.startTime

      apiLogger.debug('Response', {
        requestId: ctx.requestId,
        status: response.status,
        ms: Math.round(elapsed),
      })

      if (!response.ok || !data.success) {
        throw new ApiError(parseError(data.error, response.status, ctx.requestId))
      }

      return data as T
    } catch (err) {
      // Re-throw ApiError as-is
      if (err instanceof ApiError) {
        throw err
      }

      // Wrap network errors
      const networkError = Errors.network(
        err instanceof Error ? err.message : 'Network request failed',
        { correlationId: ctx.requestId }
      )
      throw new ApiError(networkError)
    } finally {
      // Clean up in-flight cache after request completes
      inFlightRequests.delete(requestKey)
    }
  })()

  // Cache the in-flight request
  inFlightRequests.set(requestKey, requestPromise)

  return requestPromise
}

// ─────────────────────────────────────────────────────────────
// API Functions
// ─────────────────────────────────────────────────────────────

/**
 * Load parquet data from a URL via the backend.
 */
export async function loadDataFromUrl(
  url: string,
  options?: LoadDataOptions
): Promise<LoadResponse> {
  const { onProgress, onLog } = options ?? {}

  onProgress?.({
    stage: 'initializing',
    percent: 5,
    message: 'Connecting to server...',
    timestamp: Date.now(),
  })
  onLog?.({
    level: 'info',
    message: 'Connecting to MotherDuck via backend',
    timestamp: Date.now(),
  })

  onProgress?.({
    stage: 'downloading',
    percent: 20,
    message: 'Loading data from URL...',
    timestamp: Date.now(),
  })
  onLog?.({
    level: 'info',
    message: `Loading ${url}`,
    timestamp: Date.now(),
  })

  const result = await apiPost<LoadResponse>('/api/motherduck/load', { url })

  onProgress?.({
    stage: 'complete',
    percent: 100,
    message: `Loaded ${result.rowCount?.toLocaleString() ?? 0} rows`,
    timestamp: Date.now(),
  })
  onLog?.({
    level: 'info',
    message: `Loaded ${result.rowCount?.toLocaleString() ?? 0} rows`,
    timestamp: Date.now(),
  })

  return result
}

/**
 * Get all dashboard data via the backend.
 */
export async function getDashboardData(options?: {
  bucketMinutes?: number
  whereClause?: string
  limit?: number
  offset?: number
}): Promise<DashboardData> {
  const { bucketMinutes = 60, whereClause = '1=1', limit, offset } = options ?? {}

  const response = await apiPost<DashboardResponse>('/api/motherduck/dashboard', {
    bucketMinutes,
    whereClause,
    limit,
    offset,
  })

  if (!response.data) {
    throw new ApiError(Errors.internal('No data returned from dashboard endpoint'))
  }

  return response.data
}

/**
 * Get flows with pagination (lightweight - no aggregations).
 * Use this for page navigation and filter changes.
 */
export async function getFlows(options?: {
  whereClause?: string
  limit?: number
  offset?: number
}): Promise<{ flows: Record<string, unknown>[]; totalCount: number }> {
  const { whereClause = '1=1', limit = 50, offset = 0 } = options ?? {}

  const response = await apiPost<FlowsResponse>('/api/motherduck/flows', {
    whereClause,
    limit,
    offset,
  })

  if (!response.data) {
    throw new ApiError(Errors.internal('No data returned from flows endpoint'))
  }

  return response.data
}

/**
 * Execute a raw SQL query via the backend.
 */
export async function executeQuery<T = Record<string, unknown>>(
  sql: string
): Promise<T[]> {
  const response = await apiPost<QueryResponse>('/api/motherduck/query', { sql })

  if (!response.data) {
    throw new ApiError(Errors.internal('No data returned from query endpoint'))
  }

  return response.data as T[]
}

// ─────────────────────────────────────────────────────────────
// Chat API Functions
// ─────────────────────────────────────────────────────────────

/**
 * Ask the AI what queries are needed to answer a question.
 * Returns SQL queries to execute.
 */
export async function askQuestion(
  question: string,
  turnstileToken = 'dev-token'
): Promise<{ queries: string[]; reasoning?: string }> {
  const response = await apiPost<ChatQueryResponse>('/api/chat/query', {
    question,
    turnstileToken,
  })

  return {
    queries: response.queries ?? [],
    reasoning: response.reasoning,
  }
}

/**
 * Ask the AI to analyze query results and answer the question.
 */
export async function analyzeData(
  question: string,
  data: unknown[],
  turnstileToken = 'dev-token'
): Promise<string> {
  const response = await apiPost<ChatAnalyzeResponse>('/api/chat/analyze', {
    question,
    data,
    turnstileToken,
  })

  return response.response ?? 'No response from AI'
}

/**
 * Full chat flow: ask question → execute queries → analyze results.
 * Returns the AI's analysis response.
 */
export async function chat(
  question: string,
  turnstileToken = 'dev-token'
): Promise<{ response: string; queries: string[]; data: unknown[] }> {
  // Step 1: Get queries from AI
  const { queries } = await askQuestion(question, turnstileToken)

  // If no queries needed (greeting/simple question), return early
  if (queries.length === 0) {
    const response = await analyzeData(question, [], turnstileToken)
    return { response, queries: [], data: [] }
  }

  // Step 2: Execute queries
  const allData: unknown[] = []
  for (const sql of queries) {
    const results = await executeQuery(sql)
    allData.push(...results)
  }

  // Step 3: Analyze results
  const response = await analyzeData(question, allData, turnstileToken)

  return { response, queries, data: allData }
}
