/**
 * SQL escaping utilities for preventing SQL injection.
 *
 * These functions implement proper escaping for DuckDB/PostgreSQL-style SQL.
 */

/**
 * Escape a string value for use in SQL.
 * Escapes single quotes and backslashes.
 *
 * @example
 * escapeString("O'Brien") // "O''Brien"
 */
export function escapeString(value: string): string {
  // Escape backslashes first, then single quotes
  return value.replace(/\\/g, '\\\\').replace(/'/g, "''");
}

/**
 * Escape a string for use in a LIKE pattern.
 * Escapes %, _, and single quotes.
 *
 * @example
 * escapeLikePattern("50%_test") // "50\\%\\_test"
 */
export function escapeLikePattern(value: string): string {
  return value
    .replace(/'/g, "''")
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_');
}

/**
 * Escape an identifier (column/table name) for SQL.
 * Wraps in double quotes and escapes embedded double quotes.
 *
 * @example
 * escapeIdentifier("my column") // '"my column"'
 */
export function escapeIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

/**
 * Validate that a column name is safe to use in SQL.
 * Only allows alphanumeric characters and underscores.
 *
 * @example
 * isValidColumnName("IPV4_SRC_ADDR") // true
 * isValidColumnName("DROP TABLE") // false
 */
export function isValidColumnName(name: string): boolean {
  if (!name || name.trim().length === 0) {
    return false;
  }

  // Only allow alphanumeric, underscores
  const validPattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
  if (!validPattern.test(name)) {
    return false;
  }

  // Disallow SQL keywords (basic list)
  const sqlKeywords = [
    'DROP',
    'DELETE',
    'INSERT',
    'UPDATE',
    'SELECT',
    'UNION',
    'CREATE',
    'ALTER',
    'TRUNCATE',
  ];
  const upperName = name.toUpperCase();
  if (sqlKeywords.includes(upperName)) {
    return false;
  }

  return true;
}

/**
 * Dangerous SQL patterns that should never appear in custom conditions
 */
const DANGEROUS_PATTERNS = [
  /;\s*DROP/i,
  /;\s*DELETE/i,
  /;\s*INSERT/i,
  /;\s*UPDATE/i,
  /;\s*CREATE/i,
  /;\s*ALTER/i,
  /;\s*TRUNCATE/i,
  /UNION\s+SELECT/i,
  /--/,
  /\/\*/,
  /'\s*OR\s+'?1'?\s*=\s*'?1/i,
];

/**
 * Dangerous SQL keywords that indicate DML/DDL operations
 */
const DANGEROUS_KEYWORDS = ['DROP', 'DELETE', 'INSERT', 'UPDATE', 'CREATE', 'ALTER', 'TRUNCATE'];

/**
 * Validate that a custom SQL condition is safe.
 * Checks for common SQL injection patterns.
 *
 * @throws Error if the condition contains dangerous patterns
 */
export function validateCustomCondition(condition: string): void {
  // Check for dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(condition)) {
      throw new Error(`SQL injection detected: condition contains forbidden pattern`);
    }
  }

  // Check for dangerous keywords as standalone words
  const words = condition.toUpperCase().split(/\s+/);
  for (const word of words) {
    if (DANGEROUS_KEYWORDS.includes(word)) {
      throw new Error(`SQL injection detected: condition contains forbidden keyword "${word}"`);
    }
  }
}
