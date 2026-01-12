/**
 * Debug endpoint to test DuckDB and MotherDuck connection
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'

// Set HOME before any DuckDB operations - required for serverless
if (!process.env.HOME) {
  process.env.HOME = '/tmp'
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const diagnostics: Record<string, unknown> = {
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.version,
  }

  try {
    // Check token exists
    const token = process.env.MOTHERDUCK_TOKEN
    diagnostics.hasToken = !!token
    diagnostics.tokenLength = token?.length || 0
    diagnostics.tokenPrefix = token?.substring(0, 10) + '...'

    // Try to require the module
    // @ts-expect-error - duckdb-lambda-x86 has no types
    const duckdb = await import('duckdb-lambda-x86')
    diagnostics.moduleLoaded = true

    // Test in-memory database first
    const memDb = new duckdb.default.Database(':memory:')
    await new Promise<void>((resolve, reject) => {
      memDb.all('SELECT 42 as test', (err: Error | null, rows: unknown[]) => {
        if (err) reject(err)
        else {
          diagnostics.memoryDbWorks = true
          diagnostics.memoryResult = rows
          resolve()
        }
      })
    })

    // Test MotherDuck connection if requested
    if (req.query.motherduck === 'true' && token) {
      diagnostics.attemptingMotherDuck = true
      const connectionString = `md:?motherduck_token=${token}`
      diagnostics.connectionStringFormat = 'md:?motherduck_token=<token>'

      await new Promise<void>((resolve, reject) => {
        const mdDb = new duckdb.default.Database(connectionString, (err: Error | null) => {
          if (err) {
            diagnostics.motherDuckError = err.message
            reject(err)
          } else {
            diagnostics.motherDuckConnected = true
            // Try a simple query
            mdDb.all('SELECT 1 as test', (qErr: Error | null, rows: unknown[]) => {
              if (qErr) {
                diagnostics.motherDuckQueryError = qErr.message
                reject(qErr)
              } else {
                diagnostics.motherDuckQueryResult = rows
                resolve()
              }
            })
          }
        })
      })
    }

    return res.status(200).json({ success: true, diagnostics })
  } catch (error) {
    diagnostics.error = error instanceof Error ? error.message : String(error)
    diagnostics.stack = error instanceof Error ? error.stack : undefined
    return res.status(500).json({ success: false, diagnostics })
  }
}
