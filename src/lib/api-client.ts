/**
 * Frontend API Client for MotherDuck Operations
 *
 * Calls backend API endpoints instead of connecting directly to MotherDuck.
 * This keeps the token secure on the server side.
 */

import type { DashboardData } from '@/api/routes/motherduck'
import type { ProgressCallback, LogCallback } from './progress'

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
  error?: string
}

interface DashboardResponse {
  success: boolean
  data?: DashboardData
  error?: string
}

interface QueryResponse {
  success: boolean
  data?: Record<string, unknown>[]
  error?: string
}

// ─────────────────────────────────────────────────────────────
// Helper
// ─────────────────────────────────────────────────────────────

async function apiPost<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const data = await response.json()

  if (!response.ok || !data.success) {
    throw new Error(data.error || 'API request failed')
  }

  return data
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
    throw new Error('No data returned from dashboard endpoint')
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
    throw new Error('No data returned from query endpoint')
  }

  return response.data as T[]
}
