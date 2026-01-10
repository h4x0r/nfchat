import * as duckdb from '@duckdb/duckdb-wasm';
import duckdb_wasm from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url';
import duckdb_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url';
import { unzipSync } from 'fflate';

let db: duckdb.AsyncDuckDB | null = null;
let conn: duckdb.AsyncDuckDBConnection | null = null;

// Parquet magic bytes: "PAR1" at start and end of file
const PARQUET_MAGIC = new Uint8Array([0x50, 0x41, 0x52, 0x31]); // "PAR1"

/**
 * Validate that a buffer contains a valid parquet file by checking magic bytes
 */
function validateParquetFile(buffer: ArrayBuffer): void {
  const bytes = new Uint8Array(buffer);

  if (bytes.length < 8) {
    throw new Error('File is too small to be a valid Parquet file');
  }

  // Check start magic bytes
  const startMagic = bytes.slice(0, 4);
  const startValid = startMagic.every((b, i) => b === PARQUET_MAGIC[i]);

  // Check end magic bytes
  const endMagic = bytes.slice(-4);
  const endValid = endMagic.every((b, i) => b === PARQUET_MAGIC[i]);

  if (!startValid || !endValid) {
    throw new Error(
      'Invalid Parquet file: missing magic bytes. The file may be corrupted, ' +
      'incomplete, or not a Parquet file. Please ensure you upload a valid .parquet file.'
    );
  }
}

export async function initDuckDB(): Promise<duckdb.AsyncDuckDB> {
  if (db) return db;

  const worker = new Worker(duckdb_worker);
  const logger = new duckdb.ConsoleLogger();
  db = new duckdb.AsyncDuckDB(logger, worker);

  await db.instantiate(duckdb_wasm);

  return db;
}

export async function getConnection(): Promise<duckdb.AsyncDuckDBConnection> {
  if (conn) return conn;

  const database = await initDuckDB();
  conn = await database.connect();

  return conn;
}

export async function loadParquetData(url: string): Promise<number> {
  const connection = await getConnection();

  // Register the parquet file from URL
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();

  // Validate before registering
  validateParquetFile(buffer);

  const database = await initDuckDB();
  await database.registerFileBuffer('flows.parquet', new Uint8Array(buffer));

  // Create a table from the parquet file (materialized for fast queries)
  await connection.query(`
    CREATE OR REPLACE TABLE flows AS
    SELECT * FROM read_parquet('flows.parquet')
  `);

  // Get row count
  const result = await connection.query('SELECT COUNT(*) as cnt FROM flows');
  const count = result.toArray()[0]?.cnt as number;

  return count;
}

/**
 * Load parquet data from a local File object (browser File API)
 * Supports large files through streaming - doesn't load entire file into memory
 */
export async function loadParquetFromFile(file: File): Promise<number> {
  const connection = await getConnection();
  const database = await initDuckDB();

  // Read file as ArrayBuffer
  const buffer = await file.arrayBuffer();

  // Validate before registering
  validateParquetFile(buffer);

  // Register the file buffer with DuckDB
  await database.registerFileBuffer('flows.parquet', new Uint8Array(buffer));

  // Create a table from the parquet file (materialized for fast queries)
  await connection.query(`
    CREATE OR REPLACE TABLE flows AS
    SELECT * FROM read_parquet('flows.parquet')
  `);

  // Get row count
  const result = await connection.query('SELECT COUNT(*) as cnt FROM flows');
  const count = result.toArray()[0]?.cnt as number;

  return count;
}

export async function loadCSVData(url: string): Promise<number> {
  const connection = await getConnection();

  // Register the CSV file from URL
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();

  const database = await initDuckDB();
  await database.registerFileBuffer('flows.csv', new Uint8Array(buffer));

  // Create a table from the CSV file (materialized for fast queries)
  await connection.query(`
    CREATE OR REPLACE TABLE flows AS
    SELECT * FROM read_csv('flows.csv', auto_detect=true)
  `);

  // Get row count
  const result = await connection.query('SELECT COUNT(*) as cnt FROM flows');
  const count = result.toArray()[0]?.cnt as number;

  return count;
}

/**
 * Load CSV data from a local File object (browser File API)
 */
export async function loadCSVFromFile(file: File): Promise<number> {
  const connection = await getConnection();
  const database = await initDuckDB();

  // Read file as ArrayBuffer
  const buffer = await file.arrayBuffer();

  // Register the file buffer with DuckDB
  await database.registerFileBuffer('flows.csv', new Uint8Array(buffer));

  // Create a table from the CSV file (materialized for fast queries)
  await connection.query(`
    CREATE OR REPLACE TABLE flows AS
    SELECT * FROM read_csv('flows.csv', auto_detect=true)
  `);

  // Get row count
  const result = await connection.query('SELECT COUNT(*) as cnt FROM flows');
  const count = result.toArray()[0]?.cnt as number;

  return count;
}

/**
 * Load data from a ZIP file (browser File API)
 * Extracts the ZIP and looks for .parquet or .csv files inside
 */
export async function loadZipFile(file: File): Promise<number> {
  const connection = await getConnection();
  const database = await initDuckDB();

  // Read file as ArrayBuffer
  const buffer = await file.arrayBuffer();
  const zipData = new Uint8Array(buffer);

  // Extract ZIP contents
  const files = unzipSync(zipData);
  const fileNames = Object.keys(files);

  // Find data files (prefer parquet, then csv)
  const parquetFile = fileNames.find(name =>
    name.toLowerCase().endsWith('.parquet') && !name.startsWith('__MACOSX')
  );
  const csvFile = fileNames.find(name =>
    name.toLowerCase().endsWith('.csv') && !name.startsWith('__MACOSX')
  );

  if (parquetFile) {
    const data = files[parquetFile];

    // Validate parquet
    validateParquetFile(data.buffer as ArrayBuffer);

    await database.registerFileBuffer('flows.parquet', data);
    await connection.query(`
      CREATE OR REPLACE TABLE flows AS
      SELECT * FROM read_parquet('flows.parquet')
    `);
  } else if (csvFile) {
    const data = files[csvFile];
    await database.registerFileBuffer('flows.csv', data);
    await connection.query(`
      CREATE OR REPLACE TABLE flows AS
      SELECT * FROM read_csv('flows.csv', auto_detect=true)
    `);
  } else {
    throw new Error(
      'No data file found in ZIP. Please ensure the ZIP contains a .parquet or .csv file.'
    );
  }

  // Get row count
  const result = await connection.query('SELECT COUNT(*) as cnt FROM flows');
  const count = result.toArray()[0]?.cnt as number;

  return count;
}

/**
 * Convert BigInt values to Numbers in query results.
 * DuckDB returns BIGINT columns as JavaScript BigInt, but most
 * JavaScript libraries (charts, etc.) expect regular numbers.
 */
function convertBigInts<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'bigint') return Number(obj) as T;
  if (Array.isArray(obj)) return obj.map(convertBigInts) as T;
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = convertBigInts(value);
    }
    return result as T;
  }
  return obj;
}

export async function executeQuery<T = Record<string, unknown>>(
  sql: string
): Promise<T[]> {
  const connection = await getConnection();
  const result = await connection.query(sql);
  const rows = result.toArray() as T[];
  return convertBigInts(rows);
}

export async function getTimeRange(): Promise<{ min: number; max: number }> {
  const result = await executeQuery<{ min_time: number; max_time: number }>(`
    SELECT
      MIN(FLOW_START_MILLISECONDS) as min_time,
      MAX(FLOW_END_MILLISECONDS) as max_time
    FROM flows
  `);

  return {
    min: result[0].min_time,
    max: result[0].max_time,
  };
}

export async function getAttackDistribution(): Promise<
  { attack: string; count: number }[]
> {
  return executeQuery(`
    SELECT Attack as attack, COUNT(*) as count
    FROM flows
    GROUP BY Attack
    ORDER BY count DESC
  `);
}

export async function getTopTalkers(
  direction: 'src' | 'dst',
  metric: 'bytes' | 'flows',
  limit: number = 10,
  whereClause: string = '1=1'
): Promise<{ ip: string; value: number }[]> {
  const ipCol = direction === 'src' ? 'IPV4_SRC_ADDR' : 'IPV4_DST_ADDR';
  const valueExpr = metric === 'bytes' ? 'SUM(IN_BYTES + OUT_BYTES)' : 'COUNT(*)';

  return executeQuery(`
    SELECT ${ipCol} as ip, ${valueExpr} as value
    FROM flows
    WHERE ${whereClause}
    GROUP BY ${ipCol}
    ORDER BY value DESC
    LIMIT ${limit}
  `);
}

export async function getProtocolDistribution(
  whereClause: string = '1=1'
): Promise<{ protocol: number; count: number }[]> {
  return executeQuery(`
    SELECT PROTOCOL as protocol, COUNT(*) as count
    FROM flows
    WHERE ${whereClause}
    GROUP BY PROTOCOL
    ORDER BY count DESC
  `);
}

export async function getTimelineData(
  bucketMinutes: number = 60,
  whereClause: string = '1=1'
): Promise<{ time: number; attack: string; count: number }[]> {
  const bucketMs = bucketMinutes * 60 * 1000;

  return executeQuery(`
    SELECT
      (FLOW_START_MILLISECONDS / ${bucketMs}) * ${bucketMs} as time,
      Attack as attack,
      COUNT(*) as count
    FROM flows
    WHERE ${whereClause}
    GROUP BY time, attack
    ORDER BY time, attack
  `);
}

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
  `);
}

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
  `);
}

export async function getFlowCount(whereClause: string = '1=1'): Promise<number> {
  const result = await executeQuery<{ cnt: number }>(`
    SELECT COUNT(*) as cnt FROM flows WHERE ${whereClause}
  `);
  return result[0].cnt;
}
