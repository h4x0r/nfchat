/**
 * MotherDuck API Route Handlers
 *
 * Server-side handlers for MotherDuck operations.
 * Token is stored in MOTHERDUCK_TOKEN environment variable.
 */

import { MDConnection } from '@motherduck/wasm-client'

// Singleton connection
let connection: MDConnection | null = null

/**
 * Get MotherDuck token from environment.
 */
function getToken(): string | null {
  return process.env.MOTHERDUCK_TOKEN || null
}

/**
 * Initialize or get existing MotherDuck connection.
 */
async function getConnection(): Promise<MDConnection> {
  if (connection) return connection

  const token = getToken()
  if (!token) {
    throw new Error('MotherDuck token not configured on server')
  }

  connection = MDConnection.create({ mdToken: token })
  await connection.isInitialized()
  return connection
}

/**
 * Convert BigInt values to Numbers in query results.
 */
function convertBigInts<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj
  if (typeof obj === 'bigint') return Number(obj) as T
  if (Array.isArray(obj)) return obj.map(convertBigInts) as T
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
      result[key] = convertBigInts(value)
    }
    return result as T
  }
  return obj
}

// ─────────────────────────────────────────────────────────────
// Request/Response Types
// ─────────────────────────────────────────────────────────────

export interface QueryRequest {
  sql: string
}

export interface QueryResponse {
  success: boolean
  data?: Record<string, unknown>[]
  error?: string
}

export interface LoadFromUrlRequest {
  url: string
  tableName?: string
}

export interface LoadFromUrlResponse {
  success: boolean
  rowCount?: number
  error?: string
}

export interface GetDashboardDataRequest {
  bucketMinutes?: number
  whereClause?: string
  limit?: number
  offset?: number
}

export interface DashboardData {
  timeline: { time: number; attack: string; count: number }[]
  attacks: { attack: string; count: number }[]
  topSrcIPs: { ip: string; value: number }[]
  topDstIPs: { ip: string; value: number }[]
  flows: Record<string, unknown>[]
  totalCount: number
}

export interface GetDashboardDataResponse {
  success: boolean
  data?: DashboardData
  error?: string
}

// ─────────────────────────────────────────────────────────────
// Handlers
// ─────────────────────────────────────────────────────────────

/**
 * Execute a SQL query on MotherDuck.
 */
export async function handleQuery(req: QueryRequest): Promise<QueryResponse> {
  const { sql } = req

  // Validate
  if (!sql || sql.trim().length === 0) {
    return { success: false, error: 'Missing SQL query' }
  }

  // Check token
  if (!getToken()) {
    return { success: false, error: 'MotherDuck token not configured' }
  }

  try {
    const conn = await getConnection()
    const result = await conn.evaluateQuery(sql)
    const rows = result.data.toRows() as Record<string, unknown>[]
    return { success: true, data: convertBigInts(rows) }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Query execution failed'
    return { success: false, error: message }
  }
}

/**
 * Load parquet data from a URL into MotherDuck.
 */
export async function handleLoadFromUrl(
  req: LoadFromUrlRequest
): Promise<LoadFromUrlResponse> {
  const { url, tableName = 'flows' } = req

  // Validate URL
  if (!url || url.trim().length === 0) {
    return { success: false, error: 'Missing URL' }
  }

  // Validate URL format
  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
  } catch {
    return { success: false, error: 'Invalid URL format' }
  }

  // Require HTTPS
  if (parsedUrl.protocol !== 'https:') {
    return { success: false, error: 'URL must use HTTPS' }
  }

  // Check token
  if (!getToken()) {
    return { success: false, error: 'MotherDuck token not configured' }
  }

  try {
    const conn = await getConnection()

    // Create table from parquet URL
    await conn.evaluateQuery(`
      CREATE OR REPLACE TABLE ${tableName} AS
      SELECT * FROM read_parquet('${url}')
    `)

    // Get row count
    const countResult = await conn.evaluateQuery(
      `SELECT COUNT(*) as cnt FROM ${tableName}`
    )
    const rows = countResult.data.toRows() as { cnt: number | bigint }[]
    const rowCount = Number(rows[0].cnt)

    return { success: true, rowCount }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load data'
    return { success: false, error: message }
  }
}

/**
 * Get all dashboard data in a single API call.
 * More efficient than multiple round trips.
 */
export async function handleGetDashboardData(
  req: GetDashboardDataRequest
): Promise<GetDashboardDataResponse> {
  const {
    bucketMinutes = 60,
    whereClause = '1=1',
    limit = 1000,
    offset = 0,
  } = req

  // Check token
  if (!getToken()) {
    return { success: false, error: 'MotherDuck token not configured' }
  }

  try {
    const conn = await getConnection()
    const bucketMs = bucketMinutes * 60 * 1000

    // Execute all queries in parallel
    const [
      timelineResult,
      attacksResult,
      srcIPsResult,
      dstIPsResult,
      flowsResult,
      countResult,
    ] = await Promise.all([
      // Timeline data
      conn.evaluateQuery(`
        SELECT
          (FLOW_START_MILLISECONDS / ${bucketMs}) * ${bucketMs} as time,
          Attack as attack,
          COUNT(*) as count
        FROM flows
        WHERE ${whereClause}
        GROUP BY time, attack
        ORDER BY time, attack
      `),
      // Attack distribution
      conn.evaluateQuery(`
        SELECT Attack as attack, COUNT(*) as count
        FROM flows
        GROUP BY Attack
        ORDER BY count DESC
      `),
      // Top source IPs
      conn.evaluateQuery(`
        SELECT IPV4_SRC_ADDR as ip, COUNT(*) as value
        FROM flows
        WHERE ${whereClause}
        GROUP BY IPV4_SRC_ADDR
        ORDER BY value DESC
        LIMIT 10
      `),
      // Top destination IPs
      conn.evaluateQuery(`
        SELECT IPV4_DST_ADDR as ip, COUNT(*) as value
        FROM flows
        WHERE ${whereClause}
        GROUP BY IPV4_DST_ADDR
        ORDER BY value DESC
        LIMIT 10
      `),
      // Flow records
      conn.evaluateQuery(`
        SELECT *
        FROM flows
        WHERE ${whereClause}
        ORDER BY FLOW_START_MILLISECONDS DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `),
      // Total count
      conn.evaluateQuery(`
        SELECT COUNT(*) as cnt FROM flows WHERE ${whereClause}
      `),
    ])

    const data: DashboardData = {
      timeline: convertBigInts(timelineResult.data.toRows() as DashboardData['timeline']),
      attacks: convertBigInts(attacksResult.data.toRows() as DashboardData['attacks']),
      topSrcIPs: convertBigInts(srcIPsResult.data.toRows() as DashboardData['topSrcIPs']),
      topDstIPs: convertBigInts(dstIPsResult.data.toRows() as DashboardData['topDstIPs']),
      flows: convertBigInts(flowsResult.data.toRows() as DashboardData['flows']),
      totalCount: Number((countResult.data.toRows() as { cnt: number | bigint }[])[0].cnt),
    }

    return { success: true, data }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to get dashboard data'
    return { success: false, error: message }
  }
}

/**
 * Reset the connection (useful for testing).
 */
export function resetConnection(): void {
  connection = null
}
