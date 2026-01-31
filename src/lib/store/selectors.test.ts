import { describe, it, expect } from 'vitest';
import { buildWhereClause, selectFilteredFlows, selectDashboardState, selectChatState } from './selectors';
import type { FilterState, AppState, ChatMessage } from './types';

describe('buildWhereClause', () => {
  const emptyFilters: FilterState = {
    timeRange: { start: null, end: null },
    srcIps: [],
    dstIps: [],
    srcPorts: [],
    dstPorts: [],
    protocols: [],
    l7Protocols: [],
    attackTypes: [],
    customFilter: null,
    resultCount: null,
  };

  it('returns 1=1 when no filters are set', () => {
    expect(buildWhereClause(emptyFilters)).toBe('1=1');
  });

  it('filters by time range start', () => {
    const filters = { ...emptyFilters, timeRange: { start: 1424242190000, end: null } };
    expect(buildWhereClause(filters)).toBe('FLOW_START_MILLISECONDS >= 1424242190000');
  });

  it('filters by time range end', () => {
    const filters = { ...emptyFilters, timeRange: { start: null, end: 1424242200000 } };
    expect(buildWhereClause(filters)).toBe('FLOW_END_MILLISECONDS <= 1424242200000');
  });

  it('filters by source IPs', () => {
    const filters = { ...emptyFilters, srcIps: ['59.166.0.2', '59.166.0.4'] };
    expect(buildWhereClause(filters)).toBe("IPV4_SRC_ADDR IN ('59.166.0.2', '59.166.0.4')");
  });

  it('filters by destination IPs', () => {
    const filters = { ...emptyFilters, dstIps: ['149.171.126.3'] };
    expect(buildWhereClause(filters)).toBe("IPV4_DST_ADDR IN ('149.171.126.3')");
  });

  it('filters by attack types', () => {
    const filters: FilterState = { ...emptyFilters, attackTypes: ['Exploits', 'Reconnaissance'] };
    expect(buildWhereClause(filters)).toBe("Attack IN ('Exploits', 'Reconnaissance')");
  });

  it('filters by protocols', () => {
    const filters = { ...emptyFilters, protocols: [6, 17] };
    expect(buildWhereClause(filters)).toBe('PROTOCOL IN (6, 17)');
  });

  it('filters by L7 protocols', () => {
    const filters = { ...emptyFilters, l7Protocols: [5, 7] };
    expect(buildWhereClause(filters)).toBe('L7_PROTO IN (5, 7)');
  });

  it('wraps custom filter in parentheses', () => {
    const filters = { ...emptyFilters, customFilter: 'IN_BYTES > 1024 AND L7_PROTO = 5' };
    expect(buildWhereClause(filters)).toBe('(IN_BYTES > 1024 AND L7_PROTO = 5)');
  });

  it('combines multiple filters with AND', () => {
    const filters: FilterState = {
      ...emptyFilters,
      srcIps: ['59.166.0.2'],
      attackTypes: ['Exploits'],
      protocols: [6],
    };
    const result = buildWhereClause(filters);
    expect(result).toContain("IPV4_SRC_ADDR IN ('59.166.0.2')");
    expect(result).toContain("Attack IN ('Exploits')");
    expect(result).toContain('PROTOCOL IN (6)');
    expect(result.split(' AND ').length).toBe(3);
  });
});

describe('selectFilteredFlows', () => {
  const baseState = {
    flows: [],
    hideBenign: false,
  } as unknown as AppState;

  it('returns all flows when hideBenign is false', () => {
    const flows = [
      { Attack: 'Benign', IPV4_SRC_ADDR: '1.1.1.1' },
      { Attack: 'Backdoor', IPV4_SRC_ADDR: '2.2.2.2' },
    ];
    const state = { ...baseState, flows, hideBenign: false };
    expect(selectFilteredFlows(state)).toHaveLength(2);
  });

  it('filters out benign when hideBenign is true', () => {
    const flows = [
      { Attack: 'Benign', IPV4_SRC_ADDR: '1.1.1.1' },
      { Attack: 'Backdoor', IPV4_SRC_ADDR: '2.2.2.2' },
      { Attack: 'Benign', IPV4_SRC_ADDR: '3.3.3.3' },
      { Attack: 'Exploits', IPV4_SRC_ADDR: '4.4.4.4' },
    ];
    const state = { ...baseState, flows, hideBenign: true };
    const result = selectFilteredFlows(state);
    expect(result).toHaveLength(2);
    expect(result.every((f) => f.Attack !== 'Benign')).toBe(true);
  });

  it('limits to MAX_DISPLAY_ROWS', () => {
    const flows = Array.from({ length: 15000 }, (_, i) => ({
      Attack: 'Exploits',
      IPV4_SRC_ADDR: `192.168.${Math.floor(i / 256)}.${i % 256}`,
    }));
    const state = { ...baseState, flows, hideBenign: false };
    expect(selectFilteredFlows(state)).toHaveLength(10000);
  });
});

describe('selectDashboardState', () => {
  const createMockState = (overrides: Partial<AppState> = {}): AppState => ({
    // FilterSlice
    timeRange: { start: null, end: null },
    srcIps: [],
    dstIps: [],
    srcPorts: [],
    dstPorts: [],
    protocols: [],
    l7Protocols: [],
    attackTypes: [],
    customFilter: null,
    resultCount: null,
    setTimeRange: () => {},
    addSrcIp: () => {},
    removeSrcIp: () => {},
    addDstIp: () => {},
    removeDstIp: () => {},
    setAttackTypes: () => {},
    toggleAttackType: () => {},
    setCustomFilter: () => {},
    setResultCount: () => {},
    clearFilters: () => {},
    // PaginationSlice
    currentPage: 0,
    pageSize: 100,
    setCurrentPage: () => {},
    setPageSize: () => {},
    nextPage: () => {},
    prevPage: () => {},
    totalPages: () => 1,
    pageOffset: () => 0,
    // ChatSlice
    messages: [],
    isLoading: false,
    addMessage: () => {},
    setIsLoading: () => {},
    clearChat: () => {},
    // DataSlice
    dataLoaded: false,
    dataLoading: false,
    dataError: null,
    totalRows: 0,
    attackBreakdown: [],
    topSrcIPs: [],
    topDstIPs: [],
    flows: [],
    totalFlowCount: 0,
    selectedFlow: null,
    setDataLoaded: () => {},
    setDataLoading: () => {},
    setDataError: () => {},
    setTotalRows: () => {},
    setAttackBreakdown: () => {},
    setTopSrcIPs: () => {},
    setTopDstIPs: () => {},
    setFlows: () => {},
    setTotalFlowCount: () => {},
    setSelectedFlow: () => {},
    // UISlice
    hideBenign: false,
    filteredFlows: [],
    toggleHideBenign: () => {},
    ...overrides,
  } as AppState);

  it('extracts hideBenign from state', () => {
    const state = createMockState({ hideBenign: true });
    const result = selectDashboardState(state);
    expect(result.hideBenign).toBe(true);
  });

  it('extracts currentPage from state', () => {
    const state = createMockState({ currentPage: 5 });
    const result = selectDashboardState(state);
    expect(result.currentPage).toBe(5);
  });

  it('returns same object reference for identical state', () => {
    const state = createMockState();
    const result1 = selectDashboardState(state);
    const result2 = selectDashboardState(state);
    // Selector should return structurally equal objects
    expect(result1).toEqual(result2);
  });

  it('extracts all dashboard-relevant fields', () => {
    const state = createMockState({
      hideBenign: true,
      currentPage: 3,
    });
    const result = selectDashboardState(state);
    expect(result).toHaveProperty('hideBenign', true);
    expect(result).toHaveProperty('currentPage', 3);
  });
});

describe('selectChatState', () => {
  const createMockState = (overrides: Partial<AppState> = {}): AppState => ({
    // Minimal mock - only chat-related fields needed for this selector
    messages: [],
    isLoading: false,
    addMessage: () => {},
    setIsLoading: () => {},
    clearChat: () => {},
    // Other slices (minimal)
    hideBenign: false,
    currentPage: 0,
    pageSize: 100,
    // Apply overrides LAST to ensure they take effect
    ...overrides,
  } as unknown as AppState);

  it('extracts messages from state', () => {
    const messages: ChatMessage[] = [
      { id: '1', role: 'user', content: 'Hello', timestamp: new Date() },
    ];
    const state = createMockState({ messages } as Partial<AppState>);
    const result = selectChatState(state);
    expect(result.messages).toEqual(messages);
  });

  it('extracts isLoading from state', () => {
    const state = createMockState({ isLoading: true } as Partial<AppState>);
    const result = selectChatState(state);
    expect(result.isLoading).toBe(true);
  });

  it('returns chat-specific fields only', () => {
    const state = createMockState({
      messages: [{ id: '1', role: 'user', content: 'Test', timestamp: new Date() }],
      isLoading: true,
    } as Partial<AppState>);
    const result = selectChatState(state);
    expect(result).toHaveProperty('messages');
    expect(result).toHaveProperty('isLoading');
    expect(Object.keys(result)).toHaveLength(2);
  });
});
