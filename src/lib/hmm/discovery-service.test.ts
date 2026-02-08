import { describe, it, expect, vi, beforeEach } from 'vitest'
import { discoverStates } from './discovery-service'

// Mock all dependencies
vi.mock('@/lib/motherduck/queries', () => ({
  extractFeatures: vi.fn(),
  ensureHmmStateColumn: vi.fn(),
  writeStateAssignments: vi.fn(),
  getStateSignatures: vi.fn(),
}))

vi.mock('./worker-bridge', () => ({
  trainInWorker: vi.fn(),
}))

vi.mock('./state-analyzer', () => ({
  suggestTactic: vi.fn(),
}))

vi.mock('./anomaly', () => ({
  scoreAnomalies: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    child: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
  },
}))

import { extractFeatures, ensureHmmStateColumn, writeStateAssignments, getStateSignatures } from '@/lib/motherduck/queries'
import { trainInWorker } from './worker-bridge'
import { suggestTactic } from './state-analyzer'
import { scoreAnomalies } from './anomaly'

describe('discoverStates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should complete happy path with correct flow', async () => {
    // Arrange: mock feature extraction
    const mockFeatureRows = Array.from({ length: 100 }, (_, i) => ({
      rowid: i,
      dst_ip: `10.0.0.${(i % 10) + 1}`,
      log1p_in_bytes: 5.0 + Math.random(),
      log1p_out_bytes: 4.0 + Math.random(),
      log1p_in_pkts: 3.0 + Math.random(),
      log1p_out_pkts: 2.5 + Math.random(),
      log1p_duration_ms: 6.0 + Math.random(),
      log1p_iat_avg: 4.5 + Math.random(),
      bytes_ratio: 1.2 + Math.random() * 0.5,
      pkts_per_second: 10.0 + Math.random() * 5,
      is_tcp: Math.random() > 0.5 ? 1 : 0,
      is_udp: Math.random() > 0.5 ? 1 : 0,
      is_icmp: Math.random() > 0.5 ? 1 : 0,
      port_category: Math.floor(Math.random() * 3),
    }))

    vi.mocked(ensureHmmStateColumn).mockResolvedValue(undefined)
    vi.mocked(extractFeatures).mockResolvedValue(mockFeatureRows)

    // Mock worker result
    vi.mocked(trainInWorker).mockResolvedValue({
      states: Array.from({ length: 100 }, (_, i) => i % 4), // 4 states
      nStates: 4,
      converged: true,
      iterations: 42,
      logLikelihood: -12345.67,
    })

    vi.mocked(writeStateAssignments).mockResolvedValue(undefined)

    // Mock state signatures
    const mockSignatures = [
      {
        state_id: 0,
        flow_count: 25,
        avg_in_bytes: 1024,
        avg_out_bytes: 512,
        bytes_ratio: 2.0,
        avg_duration_ms: 100,
        avg_pkts_per_sec: 10,
        tcp_pct: 0.8,
        udp_pct: 0.2,
        icmp_pct: 0.0,
        well_known_pct: 0.5,
        registered_pct: 0.3,
        ephemeral_pct: 0.2,
      },
      {
        state_id: 1,
        flow_count: 25,
        avg_in_bytes: 2048,
        avg_out_bytes: 1024,
        bytes_ratio: 2.0,
        avg_duration_ms: 200,
        avg_pkts_per_sec: 20,
        tcp_pct: 0.9,
        udp_pct: 0.1,
        icmp_pct: 0.0,
        well_known_pct: 0.7,
        registered_pct: 0.2,
        ephemeral_pct: 0.1,
      },
      {
        state_id: 2,
        flow_count: 25,
        avg_in_bytes: 512,
        avg_out_bytes: 256,
        bytes_ratio: 2.0,
        avg_duration_ms: 50,
        avg_pkts_per_sec: 5,
        tcp_pct: 0.5,
        udp_pct: 0.5,
        icmp_pct: 0.0,
        well_known_pct: 0.3,
        registered_pct: 0.4,
        ephemeral_pct: 0.3,
      },
      {
        state_id: 3,
        flow_count: 25,
        avg_in_bytes: 4096,
        avg_out_bytes: 2048,
        bytes_ratio: 2.0,
        avg_duration_ms: 300,
        avg_pkts_per_sec: 30,
        tcp_pct: 1.0,
        udp_pct: 0.0,
        icmp_pct: 0.0,
        well_known_pct: 0.9,
        registered_pct: 0.1,
        ephemeral_pct: 0.0,
      },
    ]

    vi.mocked(getStateSignatures).mockResolvedValue(mockSignatures)

    // Mock tactic suggestions
    vi.mocked(suggestTactic).mockImplementation((sig) => ({
      tactic: sig.stateId === 0 ? 'Reconnaissance' : 'Command and Control',
      confidence: 0.8,
    }))

    // Mock anomaly scores
    vi.mocked(scoreAnomalies).mockReturnValue([
      { stateId: 0, anomalyScore: 20, anomalyFactors: ['bytes_ratio'] },
      { stateId: 1, anomalyScore: 40, anomalyFactors: ['duration', 'pkts_per_sec'] },
      { stateId: 2, anomalyScore: 10, anomalyFactors: [] },
      { stateId: 3, anomalyScore: 60, anomalyFactors: ['duration', 'bytes_ratio', 'protocol_skew'] },
    ])

    const progressCalls: number[] = []
    const onProgress = (percent: number) => progressCalls.push(percent)

    // Act
    const result = await discoverStates({
      requestedStates: 4,
      sampleSize: 50000,
      onProgress,
    })

    // Assert: verify call sequence
    expect(ensureHmmStateColumn).toHaveBeenCalledOnce()
    expect(extractFeatures).toHaveBeenCalledWith(50000)
    expect(trainInWorker).toHaveBeenCalledOnce()
    expect(writeStateAssignments).toHaveBeenCalledOnce()
    expect(getStateSignatures).toHaveBeenCalledOnce()
    expect(suggestTactic).toHaveBeenCalledTimes(4)
    expect(scoreAnomalies).toHaveBeenCalledOnce()

    // Verify progress calls include 10, 80, 90
    expect(progressCalls).toContain(10)
    expect(progressCalls).toContain(80)
    expect(progressCalls).toContain(90)

    // Verify result shape
    expect(result.profiles).toHaveLength(4)
    expect(result.converged).toBe(true)
    expect(result.iterations).toBe(42)
    expect(result.logLikelihood).toBe(-12345.67)

    // Verify anomaly scores were merged into profiles
    expect(result.profiles[0].anomalyScore).toBe(20)
    expect(result.profiles[0].anomalyFactors).toEqual(['bytes_ratio'])
    expect(result.profiles[1].anomalyScore).toBe(40)
    expect(result.profiles[1].anomalyFactors).toEqual(['duration', 'pkts_per_sec'])
    expect(result.profiles[3].anomalyScore).toBe(60)
    expect(result.profiles[3].anomalyFactors).toEqual(['duration', 'bytes_ratio', 'protocol_skew'])
  })

  it('should throw error when insufficient data', async () => {
    // Arrange: only 5 rows
    vi.mocked(ensureHmmStateColumn).mockResolvedValue(undefined)
    vi.mocked(extractFeatures).mockResolvedValue([
      {
        rowid: 0,
        dst_ip: '10.0.0.1',
        log1p_in_bytes: 5.0,
        log1p_out_bytes: 4.0,
        log1p_in_pkts: 3.0,
        log1p_out_pkts: 2.5,
        log1p_duration_ms: 6.0,
        log1p_iat_avg: 4.5,
        bytes_ratio: 1.2,
        pkts_per_second: 10.0,
        is_tcp: 1,
        is_udp: 0,
        is_icmp: 0,
        port_category: 0,
      },
      {
        rowid: 1,
        dst_ip: '10.0.0.1',
        log1p_in_bytes: 5.1,
        log1p_out_bytes: 4.1,
        log1p_in_pkts: 3.1,
        log1p_out_pkts: 2.6,
        log1p_duration_ms: 6.1,
        log1p_iat_avg: 4.6,
        bytes_ratio: 1.3,
        pkts_per_second: 10.5,
        is_tcp: 1,
        is_udp: 0,
        is_icmp: 0,
        port_category: 0,
      },
    ])

    const onProgress = vi.fn()

    // Act & Assert
    await expect(
      discoverStates({
        requestedStates: 4,
        sampleSize: 50000,
        onProgress,
      })
    ).rejects.toThrow('Insufficient data for training (need at least 10 flows)')

    // Verify we didn't proceed past feature extraction
    expect(trainInWorker).not.toHaveBeenCalled()
  })

  it('should pass sampleSize to extractFeatures', async () => {
    // Arrange
    const mockFeatureRows = Array.from({ length: 20 }, (_, i) => ({
      rowid: i,
      dst_ip: `10.0.0.${(i % 4) + 1}`,
      log1p_in_bytes: 5.0,
      log1p_out_bytes: 4.0,
      log1p_in_pkts: 3.0,
      log1p_out_pkts: 2.5,
      log1p_duration_ms: 6.0,
      log1p_iat_avg: 4.5,
      bytes_ratio: 1.2,
      pkts_per_second: 10.0,
      is_tcp: 1,
      is_udp: 0,
      is_icmp: 0,
      port_category: 0,
    }))

    vi.mocked(ensureHmmStateColumn).mockResolvedValue(undefined)
    vi.mocked(extractFeatures).mockResolvedValue(mockFeatureRows)
    vi.mocked(trainInWorker).mockResolvedValue({
      states: Array.from({ length: 20 }, () => 0),
      nStates: 2,
      converged: true,
      iterations: 10,
      logLikelihood: -100,
    })
    vi.mocked(writeStateAssignments).mockResolvedValue(undefined)
    vi.mocked(getStateSignatures).mockResolvedValue([
      {
        state_id: 0,
        flow_count: 10,
        avg_in_bytes: 1024,
        avg_out_bytes: 512,
        bytes_ratio: 2.0,
        avg_duration_ms: 100,
        avg_pkts_per_sec: 10,
        tcp_pct: 0.8,
        udp_pct: 0.2,
        icmp_pct: 0.0,
        well_known_pct: 0.5,
        registered_pct: 0.3,
        ephemeral_pct: 0.2,
      },
      {
        state_id: 1,
        flow_count: 10,
        avg_in_bytes: 2048,
        avg_out_bytes: 1024,
        bytes_ratio: 2.0,
        avg_duration_ms: 200,
        avg_pkts_per_sec: 20,
        tcp_pct: 0.9,
        udp_pct: 0.1,
        icmp_pct: 0.0,
        well_known_pct: 0.7,
        registered_pct: 0.2,
        ephemeral_pct: 0.1,
      },
    ])
    vi.mocked(suggestTactic).mockReturnValue({ tactic: 'Test', confidence: 0.5 })
    vi.mocked(scoreAnomalies).mockReturnValue([
      { stateId: 0, anomalyScore: 0, anomalyFactors: [] },
      { stateId: 1, anomalyScore: 0, anomalyFactors: [] },
    ])

    // Act
    await discoverStates({
      requestedStates: 2,
      sampleSize: 100000,
      onProgress: vi.fn(),
    })

    // Assert
    expect(extractFeatures).toHaveBeenCalledWith(100000)
  })

  it('should call scoreAnomalies and merge results into profiles', async () => {
    // Arrange
    const mockFeatureRows = Array.from({ length: 15 }, (_, i) => ({
      rowid: i,
      dst_ip: `10.0.0.${(i % 3) + 1}`,
      log1p_in_bytes: 5.0,
      log1p_out_bytes: 4.0,
      log1p_in_pkts: 3.0,
      log1p_out_pkts: 2.5,
      log1p_duration_ms: 6.0,
      log1p_iat_avg: 4.5,
      bytes_ratio: 1.2,
      pkts_per_second: 10.0,
      is_tcp: 1,
      is_udp: 0,
      is_icmp: 0,
      port_category: 0,
    }))

    vi.mocked(ensureHmmStateColumn).mockResolvedValue(undefined)
    vi.mocked(extractFeatures).mockResolvedValue(mockFeatureRows)
    vi.mocked(trainInWorker).mockResolvedValue({
      states: Array.from({ length: 15 }, (_, i) => i % 3),
      nStates: 3,
      converged: true,
      iterations: 20,
      logLikelihood: -500,
    })
    vi.mocked(writeStateAssignments).mockResolvedValue(undefined)
    vi.mocked(getStateSignatures).mockResolvedValue([
      {
        state_id: 0,
        flow_count: 5,
        avg_in_bytes: 1024,
        avg_out_bytes: 512,
        bytes_ratio: 2.0,
        avg_duration_ms: 100,
        avg_pkts_per_sec: 10,
        tcp_pct: 0.8,
        udp_pct: 0.2,
        icmp_pct: 0.0,
        well_known_pct: 0.5,
        registered_pct: 0.3,
        ephemeral_pct: 0.2,
      },
      {
        state_id: 1,
        flow_count: 5,
        avg_in_bytes: 2048,
        avg_out_bytes: 1024,
        bytes_ratio: 2.0,
        avg_duration_ms: 200,
        avg_pkts_per_sec: 20,
        tcp_pct: 0.9,
        udp_pct: 0.1,
        icmp_pct: 0.0,
        well_known_pct: 0.7,
        registered_pct: 0.2,
        ephemeral_pct: 0.1,
      },
      {
        state_id: 2,
        flow_count: 5,
        avg_in_bytes: 512,
        avg_out_bytes: 256,
        bytes_ratio: 2.0,
        avg_duration_ms: 50,
        avg_pkts_per_sec: 5,
        tcp_pct: 0.5,
        udp_pct: 0.5,
        icmp_pct: 0.0,
        well_known_pct: 0.3,
        registered_pct: 0.4,
        ephemeral_pct: 0.3,
      },
    ])
    vi.mocked(suggestTactic).mockReturnValue({ tactic: 'Test', confidence: 0.5 })

    // Mock anomaly scores with different values
    vi.mocked(scoreAnomalies).mockReturnValue([
      { stateId: 0, anomalyScore: 15, anomalyFactors: ['bytes_ratio'] },
      { stateId: 1, anomalyScore: 75, anomalyFactors: ['duration', 'pkts_per_sec', 'protocol_skew'] },
      { stateId: 2, anomalyScore: 5, anomalyFactors: [] },
    ])

    // Act
    const result = await discoverStates({
      requestedStates: 3,
      sampleSize: 50000,
      onProgress: vi.fn(),
    })

    // Assert: scoreAnomalies was called
    expect(scoreAnomalies).toHaveBeenCalledOnce()
    const callArg = vi.mocked(scoreAnomalies).mock.calls[0][0]
    expect(callArg).toHaveLength(3)

    // Verify anomaly data was merged
    expect(result.profiles[0].anomalyScore).toBe(15)
    expect(result.profiles[0].anomalyFactors).toEqual(['bytes_ratio'])
    expect(result.profiles[1].anomalyScore).toBe(75)
    expect(result.profiles[1].anomalyFactors).toEqual(['duration', 'pkts_per_sec', 'protocol_skew'])
    expect(result.profiles[2].anomalyScore).toBe(5)
    expect(result.profiles[2].anomalyFactors).toEqual([])
  })

  it('should call suggestTactic for each signature', async () => {
    // Arrange
    const mockFeatureRows = Array.from({ length: 12 }, (_, i) => ({
      rowid: i,
      dst_ip: `10.0.0.${(i % 4) + 1}`,
      log1p_in_bytes: 5.0,
      log1p_out_bytes: 4.0,
      log1p_in_pkts: 3.0,
      log1p_out_pkts: 2.5,
      log1p_duration_ms: 6.0,
      log1p_iat_avg: 4.5,
      bytes_ratio: 1.2,
      pkts_per_second: 10.0,
      is_tcp: 1,
      is_udp: 0,
      is_icmp: 0,
      port_category: 0,
    }))

    vi.mocked(ensureHmmStateColumn).mockResolvedValue(undefined)
    vi.mocked(extractFeatures).mockResolvedValue(mockFeatureRows)
    vi.mocked(trainInWorker).mockResolvedValue({
      states: Array.from({ length: 12 }, (_, i) => i % 2),
      nStates: 2,
      converged: true,
      iterations: 15,
      logLikelihood: -300,
    })
    vi.mocked(writeStateAssignments).mockResolvedValue(undefined)
    vi.mocked(getStateSignatures).mockResolvedValue([
      {
        state_id: 0,
        flow_count: 6,
        avg_in_bytes: 1024,
        avg_out_bytes: 512,
        bytes_ratio: 2.0,
        avg_duration_ms: 100,
        avg_pkts_per_sec: 10,
        tcp_pct: 0.8,
        udp_pct: 0.2,
        icmp_pct: 0.0,
        well_known_pct: 0.5,
        registered_pct: 0.3,
        ephemeral_pct: 0.2,
      },
      {
        state_id: 1,
        flow_count: 6,
        avg_in_bytes: 2048,
        avg_out_bytes: 1024,
        bytes_ratio: 2.0,
        avg_duration_ms: 200,
        avg_pkts_per_sec: 20,
        tcp_pct: 0.9,
        udp_pct: 0.1,
        icmp_pct: 0.0,
        well_known_pct: 0.7,
        registered_pct: 0.2,
        ephemeral_pct: 0.1,
      },
    ])
    vi.mocked(suggestTactic).mockImplementation((sig) => ({
      tactic: sig.stateId === 0 ? 'Reconnaissance' : 'Lateral Movement',
      confidence: sig.stateId === 0 ? 0.9 : 0.7,
    }))
    vi.mocked(scoreAnomalies).mockReturnValue([
      { stateId: 0, anomalyScore: 0, anomalyFactors: [] },
      { stateId: 1, anomalyScore: 0, anomalyFactors: [] },
    ])

    // Act
    const result = await discoverStates({
      requestedStates: 2,
      sampleSize: 50000,
      onProgress: vi.fn(),
    })

    // Assert
    expect(suggestTactic).toHaveBeenCalledTimes(2)
    expect(result.profiles[0].suggestedTactic).toBe('Reconnaissance')
    expect(result.profiles[0].suggestedConfidence).toBe(0.9)
    expect(result.profiles[1].suggestedTactic).toBe('Lateral Movement')
    expect(result.profiles[1].suggestedConfidence).toBe(0.7)
  })

  it('should extract dst_ip from feature rows and pass as groupIds', async () => {
    // Arrange: feature rows with dst_ip
    const mockFeatureRows = [
      ...Array.from({ length: 5 }, (_, i) => ({
        rowid: i,
        dst_ip: '10.0.0.1',
        log1p_in_bytes: 5.0, log1p_out_bytes: 4.0, log1p_in_pkts: 3.0,
        log1p_out_pkts: 2.5, log1p_duration_ms: 6.0, log1p_iat_avg: 4.5,
        bytes_ratio: 1.2, pkts_per_second: 10.0,
        is_tcp: 1, is_udp: 0, is_icmp: 0, port_category: 0,
      })),
      ...Array.from({ length: 5 }, (_, i) => ({
        rowid: i + 5,
        dst_ip: '10.0.0.2',
        log1p_in_bytes: 8.0, log1p_out_bytes: 7.0, log1p_in_pkts: 5.0,
        log1p_out_pkts: 4.5, log1p_duration_ms: 9.0, log1p_iat_avg: 6.5,
        bytes_ratio: 2.2, pkts_per_second: 20.0,
        is_tcp: 0, is_udp: 1, is_icmp: 0, port_category: 1,
      })),
    ]

    vi.mocked(ensureHmmStateColumn).mockResolvedValue(undefined)
    vi.mocked(extractFeatures).mockResolvedValue(mockFeatureRows)
    vi.mocked(trainInWorker).mockResolvedValue({
      states: Array.from({ length: 10 }, (_, i) => i < 5 ? 0 : 1),
      nStates: 2, converged: true, iterations: 20, logLikelihood: -500,
    })
    vi.mocked(writeStateAssignments).mockResolvedValue(undefined)
    vi.mocked(getStateSignatures).mockResolvedValue([
      {
        state_id: 0, flow_count: 5, avg_in_bytes: 1024, avg_out_bytes: 512,
        bytes_ratio: 2.0, avg_duration_ms: 100, avg_pkts_per_sec: 10,
        tcp_pct: 0.8, udp_pct: 0.2, icmp_pct: 0.0,
        well_known_pct: 0.5, registered_pct: 0.3, ephemeral_pct: 0.2,
      },
      {
        state_id: 1, flow_count: 5, avg_in_bytes: 2048, avg_out_bytes: 1024,
        bytes_ratio: 2.0, avg_duration_ms: 200, avg_pkts_per_sec: 20,
        tcp_pct: 0.9, udp_pct: 0.1, icmp_pct: 0.0,
        well_known_pct: 0.7, registered_pct: 0.2, ephemeral_pct: 0.1,
      },
    ])
    vi.mocked(suggestTactic).mockReturnValue({ tactic: 'Test', confidence: 0.5 })
    vi.mocked(scoreAnomalies).mockReturnValue([
      { stateId: 0, anomalyScore: 0, anomalyFactors: [] },
      { stateId: 1, anomalyScore: 0, anomalyFactors: [] },
    ])

    await discoverStates({ requestedStates: 2, sampleSize: 50000, onProgress: vi.fn() })

    // Verify trainInWorker was called with groupIds
    const trainCall = vi.mocked(trainInWorker).mock.calls[0]
    expect(trainCall[3]).toEqual([
      '10.0.0.1', '10.0.0.1', '10.0.0.1', '10.0.0.1', '10.0.0.1',
      '10.0.0.2', '10.0.0.2', '10.0.0.2', '10.0.0.2', '10.0.0.2',
    ])
  })

  it('should return converged/iterations/logLikelihood from worker', async () => {
    // Arrange
    const mockFeatureRows = Array.from({ length: 10 }, (_, i) => ({
      rowid: i,
      dst_ip: `10.0.0.${(i % 3) + 1}`,
      log1p_in_bytes: 5.0,
      log1p_out_bytes: 4.0,
      log1p_in_pkts: 3.0,
      log1p_out_pkts: 2.5,
      log1p_duration_ms: 6.0,
      log1p_iat_avg: 4.5,
      bytes_ratio: 1.2,
      pkts_per_second: 10.0,
      is_tcp: 1,
      is_udp: 0,
      is_icmp: 0,
      port_category: 0,
    }))

    vi.mocked(ensureHmmStateColumn).mockResolvedValue(undefined)
    vi.mocked(extractFeatures).mockResolvedValue(mockFeatureRows)
    vi.mocked(trainInWorker).mockResolvedValue({
      states: Array.from({ length: 10 }, () => 0),
      nStates: 1,
      converged: false,
      iterations: 100,
      logLikelihood: -999.99,
    })
    vi.mocked(writeStateAssignments).mockResolvedValue(undefined)
    vi.mocked(getStateSignatures).mockResolvedValue([
      {
        state_id: 0,
        flow_count: 10,
        avg_in_bytes: 1024,
        avg_out_bytes: 512,
        bytes_ratio: 2.0,
        avg_duration_ms: 100,
        avg_pkts_per_sec: 10,
        tcp_pct: 0.8,
        udp_pct: 0.2,
        icmp_pct: 0.0,
        well_known_pct: 0.5,
        registered_pct: 0.3,
        ephemeral_pct: 0.2,
      },
    ])
    vi.mocked(suggestTactic).mockReturnValue({ tactic: 'Test', confidence: 0.5 })
    vi.mocked(scoreAnomalies).mockReturnValue([
      { stateId: 0, anomalyScore: 0, anomalyFactors: [] },
    ])

    // Act
    const result = await discoverStates({
      requestedStates: 1,
      sampleSize: 50000,
      onProgress: vi.fn(),
    })

    // Assert
    expect(result.converged).toBe(false)
    expect(result.iterations).toBe(100)
    expect(result.logLikelihood).toBe(-999.99)
  })
})
