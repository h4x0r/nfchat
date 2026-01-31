/**
 * MotherDuck Response Transformations
 *
 * Convert query results to usable JavaScript types.
 */

/**
 * Convert BigInt values to Numbers in query results.
 * MotherDuck returns BIGINT columns as JavaScript BigInt, but most
 * JavaScript libraries (charts, etc.) expect regular numbers.
 */
export function convertBigInts<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'bigint') return Number(obj) as T;

  // Handle arrays (including typed arrays and array-like objects from DuckDB)
  if (Array.isArray(obj)) return obj.map(convertBigInts) as T;

  // Handle array-like objects (DuckDB LIST can return these)
  if (typeof obj === 'object' && obj !== null) {
    // Check if it's iterable (like DuckDB's LIST results)
    if (Symbol.iterator in obj && typeof (obj as Iterable<unknown>)[Symbol.iterator] === 'function') {
      try {
        return Array.from(obj as Iterable<unknown>).map(convertBigInts) as T;
      } catch {
        // Fall through to object handling
      }
    }

    // Regular object - convert properties
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(obj)) {
      result[key] = convertBigInts((obj as Record<string, unknown>)[key]);
    }
    return result as T;
  }
  return obj;
}
