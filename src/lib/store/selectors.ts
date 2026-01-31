import type { FlowRecord } from '../schema';
import type { FilterState, AppState, ChatMessage } from './types';
import { WhereClauseBuilder } from '../sql';

/**
 * Dashboard state selector - combines multiple state slices into a single object.
 * Using a composite selector reduces re-renders by allowing shallow equality checks.
 */
export interface DashboardState {
  hideBenign: boolean;
  currentPage: number;
}

export const selectDashboardState = (state: AppState): DashboardState => ({
  hideBenign: state.hideBenign,
  currentPage: state.currentPage,
});

/**
 * Chat state selector - extracts chat-specific fields.
 * Allows components to subscribe only to chat state changes.
 */
export interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
}

export const selectChatState = (state: AppState): ChatState => ({
  messages: state.messages,
  isLoading: state.isLoading,
});

// Limit to 10K rows for performance - filtering millions client-side is too slow
const MAX_DISPLAY_ROWS = 10000;

export const selectFilteredFlows = (state: AppState): Partial<FlowRecord>[] => {
  const flows = state.flows;
  if (!state.hideBenign) {
    return flows.length <= MAX_DISPLAY_ROWS ? flows : flows.slice(0, MAX_DISPLAY_ROWS);
  }
  // Filter and limit - use for loop for better performance on large arrays
  const result: Partial<FlowRecord>[] = [];
  for (let i = 0; i < flows.length && result.length < MAX_DISPLAY_ROWS; i++) {
    if (flows[i].Attack !== 'Benign') {
      result.push(flows[i]);
    }
  }
  return result;
};

/**
 * Build SQL WHERE clause from filter state using safe SQL builder.
 * All string values are properly escaped to prevent SQL injection.
 */
export function buildWhereClause(state: FilterState): string {
  const builder = new WhereClauseBuilder();

  // Time range filters
  if (state.timeRange.start !== null) {
    builder.addRange('FLOW_START_MILLISECONDS', state.timeRange.start, undefined);
  }
  if (state.timeRange.end !== null) {
    builder.addRange('FLOW_END_MILLISECONDS', undefined, state.timeRange.end);
  }

  // IP address filters (strings - properly escaped)
  builder.addInClause('IPV4_SRC_ADDR', state.srcIps);
  builder.addInClause('IPV4_DST_ADDR', state.dstIps);

  // Port filters (numbers)
  builder.addInClause('L4_SRC_PORT', state.srcPorts);
  builder.addInClause('L4_DST_PORT', state.dstPorts);

  // Protocol filters (numbers)
  builder.addInClause('PROTOCOL', state.protocols);
  builder.addInClause('L7_PROTO', state.l7Protocols);

  // Attack type filter (strings - properly escaped)
  builder.addInClause('Attack', state.attackTypes);

  // Custom filter (validated for SQL injection)
  if (state.customFilter) {
    builder.addCustom(state.customFilter);
  }

  return builder.build();
}
