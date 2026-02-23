/**
 * Vercel API Route: POST /api/motherduck/load
 *
 * Load data from a URL into MotherDuck with chunked loading support.
 *
 * Actions:
 * - probe:   COUNT(*) to get total rows (fast — reads Parquet metadata)
 * - load:    CREATE TABLE from full URL (existing behavior, for small datasets)
 * - create:  CREATE TABLE from first chunk (LIMIT chunkSize)
 * - append:  INSERT INTO from subsequent chunk (LIMIT chunkSize OFFSET offset)
 * - convert: Convert CSV to Parquet in R2 via MotherDuck COPY
 *
 * Note: DuckDB code is inlined because Vercel doesn't properly trace
 * imports from shared modules in the api/ directory.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'

// Set HOME before importing DuckDB - required for serverless environments
if (!process.env.HOME) {
  process.env.HOME = '/tmp'
}

import duckdb from 'duckdb-lambda-x86'

// Singleton database
let db: ReturnType<typeof duckdb.Database> | null = null

async function getConnection(): Promise<ReturnType<typeof duckdb.Database>> {
  if (db) return db

  const token = process.env.MOTHERDUCK_TOKEN
  if (!token) {
    throw new Error('MOTHERDUCK_TOKEN not set')
  }

  return new Promise((resolve, reject) => {
    const connectionString = `md:?motherduck_token=${token}`
    db = new duckdb.Database(connectionString, (err: Error | null) => {
      if (err) {
        db = null
        reject(err)
      } else {
        resolve(db!)
      }
    })
  })
}

async function runStatement(sql: string): Promise<void> {
  const database = await getConnection()
  return new Promise((resolve, reject) => {
    database.run(sql, (err: Error | null) => {
      if (err) reject(err)
      else resolve()
    })
  })
}

async function executeQuery<T>(sql: string): Promise<T[]> {
  const database = await getConnection()
  return new Promise((resolve, reject) => {
    database.all(sql, (err: Error | null, rows: T[]) => {
      if (err) reject(err)
      else resolve(rows || [])
    })
  })
}

type ValidAction = 'load' | 'probe' | 'create' | 'append' | 'convert'
const VALID_ACTIONS: ValidAction[] = ['load', 'probe', 'create', 'append', 'convert']

/**
 * Detect reader function from URL extension.
 * MotherDuck handles parsing — no conversion needed.
 */
function getReader(url: string): string {
  const lower = url.toLowerCase()
  if (lower.endsWith('.csv') || lower.includes('.csv?')) return 'read_csv'
  return 'read_parquet'
}

/**
 * Validate that a value is a positive integer.
 * Prevents SQL injection for numeric interpolation.
 */
function validatePositiveInt(value: unknown, name: string): number {
  const num = Number(value)
  if (!Number.isInteger(num) || num <= 0) {
    throw new Error(`${name} must be a positive integer`)
  }
  return num
}

function validateNonNegativeInt(value: unknown, name: string): number {
  const num = Number(value)
  if (!Number.isInteger(num) || num < 0) {
    throw new Error(`${name} must be a non-negative integer`)
  }
  return num
}

async function probeRowCount(url: string): Promise<number> {
  const reader = getReader(url)
  console.log(`[MotherDuck] Probing row count from ${url} using ${reader}`)
  const result = await executeQuery<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM ${reader}('${url}')`
  )
  return Number(result[0].cnt)
}

async function loadData(url: string): Promise<number> {
  const reader = getReader(url)
  console.log(`[MotherDuck] Loading data from ${url} using ${reader}`)
  await runStatement(`
    CREATE OR REPLACE TABLE flows AS
    SELECT * FROM ${reader}('${url}')
  `)
  const result = await executeQuery<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM flows`)
  return Number(result[0].cnt)
}

async function createTableFromChunk(url: string, chunkSize: number): Promise<number> {
  const reader = getReader(url)
  console.log(`[MotherDuck] Creating table with first ${chunkSize} rows from ${url}`)
  await runStatement(`
    CREATE OR REPLACE TABLE flows AS
    SELECT * FROM ${reader}('${url}') LIMIT ${chunkSize}
  `)
  const result = await executeQuery<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM flows`)
  return Number(result[0].cnt)
}

async function appendChunk(url: string, offset: number, chunkSize: number): Promise<number> {
  const reader = getReader(url)
  console.log(`[MotherDuck] Appending ${chunkSize} rows at offset ${offset} from ${url}`)
  await runStatement(`
    INSERT INTO flows
    SELECT * FROM ${reader}('${url}') LIMIT ${chunkSize} OFFSET ${offset}
  `)
  const result = await executeQuery<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM flows`)
  return Number(result[0].cnt)
}

async function convertCsvToParquet(csvUrl: string, parquetKey: string): Promise<void> {
  const endpoint = process.env.R2_ENDPOINT
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
  const bucket = process.env.R2_BUCKET

  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error('R2 credentials not configured for CSV conversion')
  }

  console.log(`[MotherDuck] Converting CSV to Parquet: ${csvUrl} → s3://${bucket}/${parquetKey}`)

  await runStatement(`SET s3_access_key_id = '${accessKeyId}'`)
  await runStatement(`SET s3_secret_access_key = '${secretAccessKey}'`)
  await runStatement(`SET s3_endpoint = '${endpoint.replace('https://', '')}'`)
  await runStatement(`SET s3_region = 'auto'`)
  await runStatement(`
    COPY (SELECT * FROM read_csv('${csvUrl}'))
    TO 's3://${bucket}/${parquetKey}' (FORMAT PARQUET)
  `)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  try {
    const { url, action = 'load', chunkSize: rawChunkSize, offset: rawOffset, parquetKey } =
      req.body || {}

    // Validate action
    if (!VALID_ACTIONS.includes(action)) {
      return res.status(400).json({
        success: false,
        error: `Invalid action: ${action}. Must be one of: ${VALID_ACTIONS.join(', ')}`,
      })
    }

    // Validate URL
    if (!url || typeof url !== 'string' || url.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Missing URL' })
    }

    let parsedUrl: URL
    try {
      parsedUrl = new URL(url)
    } catch {
      return res.status(400).json({ success: false, error: 'Invalid URL format' })
    }

    if (parsedUrl.protocol !== 'https:') {
      return res.status(400).json({ success: false, error: 'URL must use HTTPS' })
    }

    switch (action as ValidAction) {
      case 'probe': {
        const rowCount = await probeRowCount(url)
        return res.status(200).json({ success: true, rowCount })
      }

      case 'load': {
        console.log('[API] Loading data from:', url)
        const rowCount = await loadData(url)
        return res.status(200).json({ success: true, rowCount })
      }

      case 'create': {
        const chunkSize = validatePositiveInt(rawChunkSize ?? 500_000, 'chunkSize')
        const rowCount = await createTableFromChunk(url, chunkSize)
        return res.status(200).json({ success: true, rowCount })
      }

      case 'append': {
        const chunkSize = validatePositiveInt(rawChunkSize ?? 500_000, 'chunkSize')
        const offset = validateNonNegativeInt(rawOffset ?? 0, 'offset')
        const rowCount = await appendChunk(url, offset, chunkSize)
        return res.status(200).json({ success: true, rowCount })
      }

      case 'convert': {
        if (!parquetKey || typeof parquetKey !== 'string') {
          return res.status(400).json({ success: false, error: 'Missing parquetKey for convert action' })
        }
        if (!parquetKey.startsWith('tmp/')) {
          return res.status(400).json({ success: false, error: 'parquetKey must start with tmp/' })
        }
        await convertCsvToParquet(url, parquetKey)
        const publicUrl = process.env.R2_PUBLIC_URL
        return res.status(200).json({
          success: true,
          url: `${publicUrl}/${parquetKey}`,
          key: parquetKey,
        })
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('MotherDuck load error:', errorMessage)
    return res.status(500).json({
      success: false,
      error: errorMessage,
    })
  }
}
