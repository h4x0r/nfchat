/**
 * Debug endpoint to test DuckDB module loading
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const diagnostics: Record<string, unknown> = {
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.version,
  }

  try {
    // Try to require the module
    // @ts-expect-error - duckdb-lambda-x86 has no types
    const duckdb = await import('duckdb-lambda-x86')
    diagnostics.moduleLoaded = true
    diagnostics.moduleKeys = Object.keys(duckdb)

    // Try to create a database
    const db = new duckdb.default.Database(':memory:')
    diagnostics.databaseCreated = true

    // Try a simple query
    await new Promise<void>((resolve, reject) => {
      db.all('SELECT 42 as test', (err: Error | null, rows: unknown[]) => {
        if (err) {
          diagnostics.queryError = err.message
          reject(err)
        } else {
          diagnostics.queryResult = rows
          resolve()
        }
      })
    })

    return res.status(200).json({ success: true, diagnostics })
  } catch (error) {
    diagnostics.error = error instanceof Error ? error.message : String(error)
    diagnostics.stack = error instanceof Error ? error.stack : undefined
    return res.status(500).json({ success: false, diagnostics })
  }
}
