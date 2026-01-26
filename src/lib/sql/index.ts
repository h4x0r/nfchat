/**
 * SQL utilities for safe query building.
 *
 * @example
 * ```ts
 * import { WhereClauseBuilder } from '@/lib/sql';
 *
 * const where = new WhereClauseBuilder()
 *   .addInClause('IPV4_SRC_ADDR', srcIps)
 *   .addRange('FLOW_START_MILLISECONDS', startTime, endTime)
 *   .build();
 * ```
 */

export { WhereClauseBuilder } from './builder';
export {
  escapeString,
  escapeLikePattern,
  escapeIdentifier,
  isValidColumnName,
  validateCustomCondition,
} from './escape';
