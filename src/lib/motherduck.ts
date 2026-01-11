/**
 * MotherDuck Client Module
 *
 * Cloud-based DuckDB client using MotherDuck service.
 * Provides the same interface as duckdb.ts for seamless migration.
 */

import { MDConnection } from '@motherduck/wasm-client'
import { getMotherDuckToken } from './motherduck-auth'
import type { ProgressCallback, LogCallback } from './progress'

// Singleton connection
let connection: MDConnection | null = null

/**
 * Initialize MotherDuck connection.
 * Requires a valid MotherDuck token configured via Settings or environment.
 */
export async function initMotherDuck(): Promise<MDConnection> {
  if (connection) return connection

  const token = getMotherDuckToken()
  if (!token) {
    throw new Error(
      'MotherDuck token not configured. Please add your token in Settings.'
    )
  }

  console.log('[MotherDuck] Creating connection...')
  connection = MDConnection.create({ mdToken: token })

  // Add timeout for initialization
  const timeoutMs = 30000
  const initPromise = connection.isInitialized()
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`MotherDuck connection timeout after ${timeoutMs}ms`)), timeoutMs)
  })

  try {
    await Promise.race([initPromise, timeoutPromise])
    console.log('[MotherDuck] Connection initialized successfully')
  } catch (err) {
    connection = null
    throw err
  }

  return connection
}

/**
 * Get the current MotherDuck connection, initializing if needed.
 */
export async function getConnection(): Promise<MDConnection> {
  return initMotherDuck()
}

/**
 * Reset the connection (useful for token changes).
 */
export function resetConnection(): void {
  connection = null
}

/**
 * Convert BigInt values to Numbers in query results.
 * MotherDuck returns BIGINT columns as JavaScript BigInt, but most
 * JavaScript libraries (charts, etc.) expect regular numbers.
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

/**
 * Execute a SQL query and return results.
 */
export async function executeQuery<T = Record<string, unknown>>(
  sql: string
): Promise<T[]> {
  const conn = await getConnection()
  const result = await conn.evaluateQuery(sql)
  const rows = result.data.toRows() as T[]
  return convertBigInts(rows)
}

/**
 * Options for loading data with progress tracking.
 */
export interface LoadDataOptions {
  onProgress?: ProgressCallback
  onLog?: LogCallback
}

/**
 * Get the time range of flow data.
 */
export async function getTimeRange(): Promise<{ min: number; max: number }> {
  const result = await executeQuery<{ min_time: number; max_time: number }>(`
    SELECT
      MIN(FLOW_START_MILLISECONDS) as min_time,
      MAX(FLOW_END_MILLISECONDS) as max_time
    FROM flows
  `)

  return {
    min: result[0].min_time,
    max: result[0].max_time,
  }
}

/**
 * Get attack type distribution.
 */
export async function getAttackDistribution(): Promise<
  { attack: string; count: number }[]
> {
  return executeQuery(`
    SELECT Attack as attack, COUNT(*) as count
    FROM flows
    GROUP BY Attack
    ORDER BY count DESC
  `)
}

/**
 * Get top IP talkers by flows or bytes.
 */
export async function getTopTalkers(
  direction: 'src' | 'dst',
  metric: 'bytes' | 'flows',
  limit: number = 10,
  whereClause: string = '1=1'
): Promise<{ ip: string; value: number }[]> {
  const ipCol = direction === 'src' ? 'IPV4_SRC_ADDR' : 'IPV4_DST_ADDR'
  const valueExpr =
    metric === 'bytes' ? 'SUM(IN_BYTES + OUT_BYTES)' : 'COUNT(*)'

  return executeQuery(`
    SELECT ${ipCol} as ip, ${valueExpr} as value
    FROM flows
    WHERE ${whereClause}
    GROUP BY ${ipCol}
    ORDER BY value DESC
    LIMIT ${limit}
  `)
}

/**
 * Get protocol distribution.
 */
export async function getProtocolDistribution(
  whereClause: string = '1=1'
): Promise<{ protocol: number; count: number }[]> {
  return executeQuery(`
    SELECT PROTOCOL as protocol, COUNT(*) as count
    FROM flows
    WHERE ${whereClause}
    GROUP BY PROTOCOL
    ORDER BY count DESC
  `)
}

/**
 * Get time-bucketed flow data for timeline visualization.
 */
export async function getTimelineData(
  bucketMinutes: number = 60,
  whereClause: string = '1=1'
): Promise<{ time: number; attack: string; count: number }[]> {
  const bucketMs = bucketMinutes * 60 * 1000

  return executeQuery(`
    SELECT
      (FLOW_START_MILLISECONDS / ${bucketMs}) * ${bucketMs} as time,
      Attack as attack,
      COUNT(*) as count
    FROM flows
    WHERE ${whereClause}
    GROUP BY time, attack
    ORDER BY time, attack
  `)
}

/**
 * Get network graph edges (source -> destination pairs).
 */
export async function getNetworkGraph(
  limit: number = 100,
  whereClause: string = '1=1'
): Promise<{ source: string; target: string; weight: number }[]> {
  return executeQuery(`
    SELECT
      IPV4_SRC_ADDR as source,
      IPV4_DST_ADDR as target,
      COUNT(*) as weight
    FROM flows
    WHERE ${whereClause}
    GROUP BY IPV4_SRC_ADDR, IPV4_DST_ADDR
    ORDER BY weight DESC
    LIMIT ${limit}
  `)
}

/**
 * Get paginated flow records.
 */
export async function getFlows(
  whereClause: string = '1=1',
  limit: number = 1000,
  offset: number = 0
): Promise<Record<string, unknown>[]> {
  return executeQuery(`
    SELECT *
    FROM flows
    WHERE ${whereClause}
    ORDER BY FLOW_START_MILLISECONDS DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `)
}

/**
 * Get total flow count with optional filter.
 */
export async function getFlowCount(
  whereClause: string = '1=1'
): Promise<number> {
  const result = await executeQuery<{ cnt: number }>(`
    SELECT COUNT(*) as cnt FROM flows WHERE ${whereClause}
  `)
  return result[0].cnt
}

/**
 * Load data from a local file into MotherDuck.
 * Uses hybrid execution: reads file locally, stores in MotherDuck cloud.
 */
export async function loadFileToMotherDuck(
  file: File,
  options?: LoadDataOptions
): Promise<number> {
  const { onProgress, onLog } = options ?? {}

  // Initialize connection
  onProgress?.({
    stage: 'initializing',
    percent: 5,
    message: 'Connecting to MotherDuck...',
    timestamp: Date.now(),
  })
  onLog?.({
    level: 'info',
    message: 'Connecting to MotherDuck cloud',
    timestamp: Date.now(),
  })

  const conn = await getConnection()

  // Determine file type
  const isParquet = file.name.toLowerCase().endsWith('.parquet')
  const isCSV = file.name.toLowerCase().endsWith('.csv')

  if (!isParquet && !isCSV) {
    throw new Error('Unsupported file type. Please upload a .parquet or .csv file.')
  }

  // Upload progress
  onProgress?.({
    stage: 'uploading',
    percent: 10,
    message: `Uploading ${file.name}...`,
    timestamp: Date.now(),
  })
  onLog?.({
    level: 'info',
    message: `Reading file: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)`,
    timestamp: Date.now(),
  })

  // Read file as ArrayBuffer
  const buffer = await file.arrayBuffer()
  const uint8Array = new Uint8Array(buffer)

  // Register file with MotherDuck's local context
  // MotherDuck hybrid execution can read from registered local files
  onProgress?.({
    stage: 'uploading',
    percent: 50,
    message: 'Transferring to MotherDuck cloud...',
    timestamp: Date.now(),
  })

  // Create table from file data
  // For MotherDuck, we need to use a different approach - attach and create table
  onProgress?.({
    stage: 'parsing',
    percent: 70,
    message: 'Creating table in MotherDuck...',
    timestamp: Date.now(),
  })
  onLog?.({
    level: 'info',
    message: 'Executing CREATE TABLE (this may take a while for large files)',
    timestamp: Date.now(),
  })

  // Convert buffer to base64 for inline loading (for smaller files)
  // For larger files, we'd use MotherDuck's file upload API
  const base64Data = btoa(
    String.fromCharCode.apply(null, Array.from(uint8Array))
  )

  if (isParquet) {
    // Use DuckDB's ability to read parquet from base64 blob
    await conn.evaluateQuery(`
      CREATE OR REPLACE TABLE flows AS
      SELECT * FROM read_parquet(decode('${base64Data}')::BLOB)
    `)
  } else {
    // CSV
    await conn.evaluateQuery(`
      CREATE OR REPLACE TABLE flows AS
      SELECT * FROM read_csv(decode('${base64Data}')::BLOB, auto_detect=true)
    `)
  }

  onLog?.({
    level: 'info',
    message: 'Table created successfully',
    timestamp: Date.now(),
  })

  // Get row count
  onProgress?.({
    stage: 'parsing',
    percent: 95,
    message: 'Counting rows...',
    timestamp: Date.now(),
  })

  const count = await getFlowCount()

  onLog?.({
    level: 'info',
    message: `Loaded ${count.toLocaleString()} rows`,
    timestamp: Date.now(),
  })

  onProgress?.({
    stage: 'complete',
    percent: 100,
    message: `Loaded ${count.toLocaleString()} rows`,
    timestamp: Date.now(),
  })

  return count
}

/**
 * Load data from a URL into MotherDuck.
 * MotherDuck can directly read from HTTP URLs.
 */
export async function loadParquetData(
  url: string,
  options?: LoadDataOptions
): Promise<number> {
  const { onProgress, onLog } = options ?? {}
  const maxRetries = 3
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Initialize connection
      onProgress?.({
        stage: 'initializing',
        percent: 5,
        message: attempt > 1 ? `Reconnecting (attempt ${attempt}/${maxRetries})...` : 'Connecting to MotherDuck...',
        timestamp: Date.now(),
      })
      onLog?.({
        level: 'info',
        message: attempt > 1 ? `Retry attempt ${attempt}/${maxRetries}` : 'Connecting to MotherDuck cloud',
        timestamp: Date.now(),
      })

      // Reset connection on retry
      if (attempt > 1) {
        resetConnection()
      }

      const conn = await getConnection()

      // Start progress animation for long-running query
      let progressPercent = 20
      const progressInterval = setInterval(() => {
        progressPercent = Math.min(progressPercent + 2, 85)
        onProgress?.({
          stage: 'downloading',
          percent: progressPercent,
          message: `Loading parquet data... ${progressPercent}%`,
          timestamp: Date.now(),
        })
      }, 2000)

      onProgress?.({
        stage: 'downloading',
        percent: 20,
        message: 'Downloading parquet file...',
        timestamp: Date.now(),
      })
      onLog?.({
        level: 'info',
        message: `Fetching ${url}`,
        timestamp: Date.now(),
      })

      // Create table directly from URL (MotherDuck handles the download)
      onLog?.({
        level: 'info',
        message: 'Creating table (this may take 1-2 minutes for large files)',
        timestamp: Date.now(),
      })

      try {
        await conn.evaluateQuery(`
          CREATE OR REPLACE TABLE flows AS
          SELECT * FROM read_parquet('${url}')
        `)
      } finally {
        clearInterval(progressInterval)
      }

      onProgress?.({
        stage: 'parsing',
        percent: 90,
        message: 'Table created successfully',
        timestamp: Date.now(),
      })
      onLog?.({
        level: 'info',
        message: 'Table created successfully',
        timestamp: Date.now(),
      })

      // Get row count
      onProgress?.({
        stage: 'parsing',
        percent: 95,
        message: 'Counting rows...',
        timestamp: Date.now(),
      })

      const count = await getFlowCount()

      onLog?.({
        level: 'info',
        message: `Loaded ${count.toLocaleString()} rows`,
        timestamp: Date.now(),
      })

      onProgress?.({
        stage: 'complete',
        percent: 100,
        message: `Loaded ${count.toLocaleString()} rows`,
        timestamp: Date.now(),
      })

      return count
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      const isRetryable = lastError.message.includes('lease expired') ||
                          lastError.message.includes('timeout') ||
                          lastError.message.includes('connection')

      onLog?.({
        level: 'warning',
        message: `Attempt ${attempt} failed: ${lastError.message}`,
        timestamp: Date.now(),
      })

      if (!isRetryable || attempt === maxRetries) {
        throw lastError
      }

      // Wait before retry with exponential backoff
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000)
      onLog?.({
        level: 'info',
        message: `Waiting ${delay / 1000}s before retry...`,
        timestamp: Date.now(),
      })
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw lastError || new Error('Failed to load parquet data')
}
