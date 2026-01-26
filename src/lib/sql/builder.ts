/**
 * SQL WHERE clause builder with SQL injection prevention.
 *
 * @example
 * const where = new WhereClauseBuilder()
 *   .addInClause('IPV4_SRC_ADDR', ['10.0.0.1', '10.0.0.2'])
 *   .addRange('FLOW_START_MILLISECONDS', startTime, endTime)
 *   .addLike('Attack', 'DoS')
 *   .build();
 */

import { escapeString, escapeLikePattern, validateCustomCondition } from './escape';

/**
 * Valid comparison operators for addCondition
 */
const VALID_OPERATORS = ['=', '!=', '<>', '<', '>', '<=', '>='] as const;
type ValidOperator = (typeof VALID_OPERATORS)[number];

export class WhereClauseBuilder {
  private conditions: string[] = [];

  /**
   * Add an IN clause for a list of values.
   * Handles both strings (escaped) and numbers (used as-is).
   *
   * @param column - Column name (must be safe identifier)
   * @param values - Array of string or number values
   */
  addInClause(column: string, values: (string | number)[]): this {
    if (values.length === 0) {
      return this;
    }

    const escaped = values.map((v) =>
      typeof v === 'string' ? `'${escapeString(v)}'` : String(v)
    );
    this.conditions.push(`${column} IN (${escaped.join(', ')})`);
    return this;
  }

  /**
   * Add a range condition (min <= column <= max).
   * Handles undefined/null values gracefully.
   *
   * @param column - Column name
   * @param min - Minimum value (inclusive), or undefined/null to skip
   * @param max - Maximum value (inclusive), or undefined/null to skip
   */
  addRange(
    column: string,
    min: number | undefined | null,
    max: number | undefined | null
  ): this {
    if (min !== undefined && min !== null) {
      this.conditions.push(`${column} >= ${min}`);
    }
    if (max !== undefined && max !== null) {
      this.conditions.push(`${column} <= ${max}`);
    }
    return this;
  }

  /**
   * Add a LIKE clause for partial string matching.
   * The pattern is wrapped in % wildcards.
   *
   * @param column - Column name
   * @param pattern - Search pattern (special chars escaped)
   */
  addLike(column: string, pattern: string): this {
    if (!pattern || pattern.trim().length === 0) {
      return this;
    }

    const escaped = escapeLikePattern(pattern);
    this.conditions.push(`${column} LIKE '%${escaped}%'`);
    return this;
  }

  /**
   * Add a simple comparison condition.
   *
   * @param column - Column name
   * @param operator - Comparison operator (=, !=, <, >, <=, >=)
   * @param value - Value to compare against
   * @throws Error if operator is invalid
   */
  addCondition(column: string, operator: string, value: string | number): this {
    if (!VALID_OPERATORS.includes(operator as ValidOperator)) {
      throw new Error(
        `Invalid operator: ${operator}. Valid operators: ${VALID_OPERATORS.join(', ')}`
      );
    }

    const formattedValue =
      typeof value === 'string' ? `'${escapeString(value)}'` : String(value);

    this.conditions.push(`${column} ${operator} ${formattedValue}`);
    return this;
  }

  /**
   * Add a custom SQL condition.
   * The condition is validated for SQL injection patterns and wrapped in parentheses.
   *
   * @param condition - Raw SQL condition (validated for safety)
   * @throws Error if condition contains dangerous SQL patterns
   */
  addCustom(condition: string): this {
    if (!condition || condition.trim().length === 0) {
      return this;
    }

    // Validate against SQL injection
    validateCustomCondition(condition);

    // Wrap in parentheses to prevent precedence issues
    this.conditions.push(`(${condition})`);
    return this;
  }

  /**
   * Build the WHERE clause.
   * Returns '1=1' if no conditions were added.
   */
  build(): string {
    if (this.conditions.length === 0) {
      return '1=1';
    }

    return this.conditions.join(' AND ');
  }

  /**
   * Check if any conditions have been added
   */
  hasConditions(): boolean {
    return this.conditions.length > 0;
  }

  /**
   * Get the number of conditions
   */
  conditionCount(): number {
    return this.conditions.length;
  }
}
