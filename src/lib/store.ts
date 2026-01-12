import { create } from 'zustand';
import type { AttackType, FlowRecord } from './schema';
import type { TimelineData } from '@/components/dashboard/TimelineChart';
import type { PlaybackSpeed } from '@/components/dashboard/timeline/constants';

export interface AttackBreakdownData {
  attack: string;
  count: number;
}

export interface TopTalkerData {
  ip: string;
  value: number;
}

export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number; // ms timestamp in data range
  speed: PlaybackSpeed;
  duration: number; // total duration in ms (computed from data)
  inPoint: number | null; // A-B selection start
  outPoint: number | null; // A-B selection end
}

export interface FilterState {
  // Time range filter
  timeRange: {
    start: number | null;
    end: number | null;
  };

  // IP filters
  srcIps: string[];
  dstIps: string[];

  // Port filters
  srcPorts: number[];
  dstPorts: number[];

  // Protocol filters
  protocols: number[];
  l7Protocols: number[];

  // Attack type filter
  attackTypes: AttackType[];

  // Custom SQL WHERE clause (from chat)
  customFilter: string | null;

  // Current query results count
  resultCount: number | null;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sql?: string;
  suggestedPivots?: string[];
  timestamp: Date;
}

export interface AppState extends FilterState {
  // Playback state
  playback: PlaybackState;
  setIsPlaying: (playing: boolean) => void;
  setCurrentTime: (time: number) => void;
  setPlaybackSpeed: (speed: PlaybackSpeed) => void;
  setPlaybackDuration: (duration: number) => void;
  setInPoint: (time: number | null) => void;
  setOutPoint: (time: number | null) => void;
  resetPlayback: () => void;

  // Filter actions
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

  // Chat state
  messages: ChatMessage[];
  isLoading: boolean;
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  setIsLoading: (loading: boolean) => void;
  clearChat: () => void;

  // Data loading state
  dataLoaded: boolean;
  dataLoading: boolean;
  dataError: string | null;
  totalRows: number;
  setDataLoaded: (loaded: boolean) => void;
  setDataLoading: (loading: boolean) => void;
  setDataError: (error: string | null) => void;
  setTotalRows: (rows: number) => void;

  // Dashboard data
  timelineData: TimelineData[];
  attackBreakdown: AttackBreakdownData[];
  topSrcIPs: TopTalkerData[];
  topDstIPs: TopTalkerData[];
  flows: Partial<FlowRecord>[];
  totalFlowCount: number;
  selectedFlow: Partial<FlowRecord> | null;
  setTimelineData: (data: TimelineData[]) => void;
  setAttackBreakdown: (data: AttackBreakdownData[]) => void;
  setTopSrcIPs: (data: TopTalkerData[]) => void;
  setTopDstIPs: (data: TopTalkerData[]) => void;
  setFlows: (flows: Partial<FlowRecord>[]) => void;
  setTotalFlowCount: (count: number) => void;
  setSelectedFlow: (flow: Partial<FlowRecord> | null) => void;
}

const initialFilterState: FilterState = {
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

const initialPlaybackState: PlaybackState = {
  isPlaying: false,
  currentTime: 0,
  speed: 1,
  duration: 0,
  inPoint: null,
  outPoint: null,
};

export const useStore = create<AppState>((set) => ({
  ...initialFilterState,

  // Playback state
  playback: initialPlaybackState,

  setIsPlaying: (playing) =>
    set((state) => ({
      playback: { ...state.playback, isPlaying: playing },
    })),

  setCurrentTime: (time) =>
    set((state) => ({
      playback: { ...state.playback, currentTime: time },
    })),

  setPlaybackSpeed: (speed) =>
    set((state) => ({
      playback: { ...state.playback, speed },
    })),

  setPlaybackDuration: (duration) =>
    set((state) => ({
      playback: { ...state.playback, duration },
    })),

  setInPoint: (time) =>
    set((state) => ({
      playback: { ...state.playback, inPoint: time },
    })),

  setOutPoint: (time) =>
    set((state) => ({
      playback: { ...state.playback, outPoint: time },
    })),

  resetPlayback: () =>
    set({ playback: initialPlaybackState }),

  // Filter actions
  setTimeRange: (start, end) =>
    set({ timeRange: { start, end } }),

  addSrcIp: (ip) =>
    set((state) => ({
      srcIps: state.srcIps.includes(ip) ? state.srcIps : [...state.srcIps, ip],
    })),

  removeSrcIp: (ip) =>
    set((state) => ({
      srcIps: state.srcIps.filter((i) => i !== ip),
    })),

  addDstIp: (ip) =>
    set((state) => ({
      dstIps: state.dstIps.includes(ip) ? state.dstIps : [...state.dstIps, ip],
    })),

  removeDstIp: (ip) =>
    set((state) => ({
      dstIps: state.dstIps.filter((i) => i !== ip),
    })),

  setAttackTypes: (types) => set({ attackTypes: types }),

  toggleAttackType: (type) =>
    set((state) => ({
      attackTypes: state.attackTypes.includes(type)
        ? state.attackTypes.filter((t) => t !== type)
        : [...state.attackTypes, type],
    })),

  setCustomFilter: (filter) => set({ customFilter: filter }),

  setResultCount: (count) => set({ resultCount: count }),

  clearFilters: () => set(initialFilterState),

  // Chat state
  messages: [],
  isLoading: false,

  addMessage: (message) =>
    set((state) => ({
      messages: [
        ...state.messages,
        {
          ...message,
          id: crypto.randomUUID(),
          timestamp: new Date(),
        },
      ],
    })),

  setIsLoading: (loading) => set({ isLoading: loading }),

  clearChat: () => set({ messages: [] }),

  // Data loading state
  dataLoaded: false,
  dataLoading: false,
  dataError: null,
  totalRows: 0,

  setDataLoaded: (loaded) => set({ dataLoaded: loaded }),
  setDataLoading: (loading) => set({ dataLoading: loading }),
  setDataError: (error) => set({ dataError: error }),
  setTotalRows: (rows) => set({ totalRows: rows }),

  // Dashboard data
  timelineData: [],
  attackBreakdown: [],
  topSrcIPs: [],
  topDstIPs: [],
  flows: [],
  totalFlowCount: 0,
  selectedFlow: null,

  setTimelineData: (data) => set({ timelineData: data }),
  setAttackBreakdown: (data) => set({ attackBreakdown: data }),
  setTopSrcIPs: (data) => set({ topSrcIPs: data }),
  setTopDstIPs: (data) => set({ topDstIPs: data }),
  setFlows: (flows) => set({ flows }),
  setTotalFlowCount: (count) => set({ totalFlowCount: count }),
  setSelectedFlow: (flow) => set({ selectedFlow: flow }),
}));

// Selector for building SQL WHERE clause from filters
export function buildWhereClause(state: FilterState): string {
  const conditions: string[] = [];

  if (state.timeRange.start !== null) {
    conditions.push(`FLOW_START_MILLISECONDS >= ${state.timeRange.start}`);
  }
  if (state.timeRange.end !== null) {
    conditions.push(`FLOW_END_MILLISECONDS <= ${state.timeRange.end}`);
  }
  if (state.srcIps.length > 0) {
    conditions.push(`IPV4_SRC_ADDR IN (${state.srcIps.map((ip) => `'${ip}'`).join(', ')})`);
  }
  if (state.dstIps.length > 0) {
    conditions.push(`IPV4_DST_ADDR IN (${state.dstIps.map((ip) => `'${ip}'`).join(', ')})`);
  }
  if (state.srcPorts.length > 0) {
    conditions.push(`L4_SRC_PORT IN (${state.srcPorts.join(', ')})`);
  }
  if (state.dstPorts.length > 0) {
    conditions.push(`L4_DST_PORT IN (${state.dstPorts.join(', ')})`);
  }
  if (state.protocols.length > 0) {
    conditions.push(`PROTOCOL IN (${state.protocols.join(', ')})`);
  }
  if (state.l7Protocols.length > 0) {
    conditions.push(`L7_PROTO IN (${state.l7Protocols.join(', ')})`);
  }
  if (state.attackTypes.length > 0) {
    conditions.push(`Attack IN (${state.attackTypes.map((t) => `'${t}'`).join(', ')})`);
  }
  if (state.customFilter) {
    conditions.push(`(${state.customFilter})`);
  }

  return conditions.length > 0 ? conditions.join(' AND ') : '1=1';
}
