/**
 * Generate a small test parquet file from the full dataset
 * Run with: npx tsx e2e/fixtures/generate-test-data.ts
 */

import duckdb from 'duckdb'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const SOURCE_FILE = path.join(__dirname, '../../public/data/NF-UNSW-NB15-v3.parquet')
const OUTPUT_FILE = path.join(__dirname, 'test-flows.parquet')

async function generateTestData() {
  console.log('Generating test parquet file...')
  console.log(`Source: ${SOURCE_FILE}`)
  console.log(`Output: ${OUTPUT_FILE}`)

  if (!fs.existsSync(SOURCE_FILE)) {
    console.error('Source file not found!')
    process.exit(1)
  }

  const db = new (duckdb as any).Database(':memory:')
  const conn = db.connect()

  // Extract 1000 rows with diverse attack types
  conn.run(`
    COPY (
      SELECT * FROM read_parquet('${SOURCE_FILE}')
      ORDER BY RANDOM()
      LIMIT 1000
    ) TO '${OUTPUT_FILE}' (FORMAT PARQUET)
  `, (err: Error | null) => {
    if (err) {
      console.error('Error:', err)
      process.exit(1)
    }
    console.log('Test data generated successfully!')

    // Verify the file
    conn.all(`SELECT COUNT(*) as cnt FROM read_parquet('${OUTPUT_FILE}')`, (err: Error | null, rows: any[]) => {
      if (err) {
        console.error('Verification error:', err)
      } else {
        console.log(`Rows in test file: ${rows[0].cnt}`)
      }
      conn.close()
      db.close()
    })
  })
}

generateTestData()
