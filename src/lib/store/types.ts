import type { AttackType, FlowRecord } from '../schema';

export interface AttackBreakdownData {
  attack: string;
  count: number;
}

export interface TopTalkerData {
  ip: string;
  value: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sql?: string;
  suggestedPivots?: string[];
  timestamp: Date;
}

// Filter slice state
export interface FilterState {
  timeRange: {
    start: number | null;
    end: number | null;
  };
  srcIps: string[];
  dstIps: string[];
  srcPorts: number[];
  dstPorts: number[];
  protocols: number[];
  l7Protocols: number[];
  attackTypes: AttackType[];
  customFilter: string | null;
  resultCount: number | null;
}

export interface FilterActions {
  setTimeRange: (start: number | null, end: number | null) => void;
  addSrcIp: (ip: string) => void;
  removeSrcIp: (ip: string) => void;
  addDstIp: (ip: string) => void;
  removeDstIp: (ip: string) => void;
  setAttackTypes: (types: AttackType[]) => void;
  toggleAttackType: (type: AttackType) => void;
  setCustomFilter: (filter: string | null) => void;
  setResultCount: (count: number | null) => void;
  clearFilters: () => void;
}

export type FilterSlice = FilterState & FilterActions;

// Pagination slice
export interface PaginationState {
  currentPage: number;
  pageSize: number;
}

export interface PaginationActions {
  setCurrentPage: (page: number) => void;
  setPageSize: (size: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  totalPages: () => number;
  pageOffset: () => number;
}

export type PaginationSlice = PaginationState & PaginationActions;

// Chat slice
export interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
}

export interface ChatActions {
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  setIsLoading: (loading: boolean) => void;
  clearChat: () => void;
}

export type ChatSlice = ChatState & ChatActions;

// Data slice (loading state + dashboard data)
export interface DataState {
  dataLoaded: boolean;
  dataLoading: boolean;
  dataError: string | null;
  totalRows: number;
  attackBreakdown: AttackBreakdownData[];
  topSrcIPs: TopTalkerData[];
  topDstIPs: TopTalkerData[];
  flows: Partial<FlowRecord>[];
  totalFlowCount: number;
  selectedFlow: Partial<FlowRecord> | null;
}

export interface DataActions {
  setDataLoaded: (loaded: boolean) => void;
  setDataLoading: (loading: boolean) => void;
  setDataError: (error: string | null) => void;
  setTotalRows: (rows: number) => void;
  setAttackBreakdown: (data: AttackBreakdownData[]) => void;
  setTopSrcIPs: (data: TopTalkerData[]) => void;
  setTopDstIPs: (data: TopTalkerData[]) => void;
  setFlows: (flows: Partial<FlowRecord>[]) => void;
  setTotalFlowCount: (count: number) => void;
  setSelectedFlow: (flow: Partial<FlowRecord> | null) => void;
}

export type DataSlice = DataState & DataActions;

// UI slice
export interface UIState {
  hideBenign: boolean;
  filteredFlows: Partial<FlowRecord>[];
}

export interface UIActions {
  toggleHideBenign: () => void;
}

export type UISlice = UIState & UIActions;

// HMM state slice
export interface StateProfile {
  stateId: number
  flowCount: number
  avgInBytes: number
  avgOutBytes: number
  bytesRatio: number
  avgDurationMs: number
  avgPktsPerSec: number
  protocolDist: { tcp: number; udp: number; icmp: number }
  portCategoryDist: { wellKnown: number; registered: number; ephemeral: number }
  connCompletePct?: number
  noReplyPct?: number
  rejectedPct?: number
  avgBytesPerPkt?: number
  avgInterFlowGapMs?: number
  anomalyScore?: number
  anomalyFactors?: string[]
}

export interface HmmState {
  hmmStates: StateProfile[]
  hmmTraining: boolean
  hmmProgress: number
  hmmError: string | null
  tacticAssignments: Record<number, string>
  expandedState: number | null
  hmmConverged: boolean | null
  hmmIterations: number | null
  hmmLogLikelihood: number | null
}

export interface HmmActions {
  setHmmStates: (states: StateProfile[]) => void
  setHmmTraining: (training: boolean) => void
  setHmmProgress: (progress: number) => void
  setHmmError: (error: string | null) => void
  setTacticAssignment: (stateId: number, tactic: string) => void
  setExpandedState: (stateId: number | null) => void
  setHmmConverged: (converged: boolean | null) => void
  setHmmIterations: (iterations: number | null) => void
  setHmmLogLikelihood: (logLikelihood: number | null) => void
  resetHmm: () => void
}

export type HmmSlice = HmmState & HmmActions;

// View slice
export interface ViewState {
  activeView: 'dashboard' | 'stateExplorer'
  selectedHmmState: number | null
}

export interface ViewActions {
  setActiveView: (view: 'dashboard' | 'stateExplorer') => void
  setSelectedHmmState: (stateId: number | null) => void
}

export type ViewSlice = ViewState & ViewActions;

// Combined app state
export type AppState = FilterSlice &
  PaginationSlice &
  ChatSlice &
  DataSlice &
  UISlice &
  HmmSlice &
  ViewSlice;
