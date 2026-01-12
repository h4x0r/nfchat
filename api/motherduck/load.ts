/**
 * Vercel API Route: POST /api/motherduck/load
 *
 * Load parquet data from a URL into MotherDuck.
 * Note: DuckDB code is inlined because Vercel doesn't properly trace
 * imports from shared modules in the api/ directory.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'

// Set HOME before importing DuckDB - required for serverless environments
if (!process.env.HOME) {
  process.env.HOME = '/tmp'
}

// @ts-expect-error - duckdb-lambda-x86 has same API as duckdb but no types
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

async function loadParquetData(url: string): Promise<number> {
  console.log(`[MotherDuck] Loading parquet from ${url}`)

  await runStatement(`
    CREATE OR REPLACE TABLE flows AS
    SELECT * FROM read_parquet('${url}')
  `)

  const result = await executeQuery<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM flows`)
  return Number(result[0].cnt)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  try {
    const { url } = req.body || {}

    // Validate URL
    if (!url || typeof url !== 'string' || url.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Missing URL' })
    }

    // Validate URL format
    let parsedUrl: URL
    try {
      parsedUrl = new URL(url)
    } catch {
      return res.status(400).json({ success: false, error: 'Invalid URL format' })
    }

    // Require HTTPS
    if (parsedUrl.protocol !== 'https:') {
      return res.status(400).json({ success: false, error: 'URL must use HTTPS' })
    }

    console.log('[API] Loading parquet from:', url)
    const rowCount = await loadParquetData(url)

    return res.status(200).json({ success: true, rowCount })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('MotherDuck load error:', errorMessage)
    return res.status(500).json({
      success: false,
      error: errorMessage,
    })
  }
}
