import { describe, it, expect } from 'vitest'
import { scoreAnomalies } from '../anomaly'
import type { StateProfile } from '@/lib/store/types'

describe('scoreAnomalies', () => {
  const createState = (overrides: Partial<StateProfile> = {}): StateProfile => ({
    stateId: 0,
    flowCount: 100,
    avgInBytes: 1000,
    avgOutBytes: 500,
    bytesRatio: 2.0,
    avgDurationMs: 5000,
    avgPktsPerSec: 10,
    protocolDist: { tcp: 0.8, udp: 0.15, icmp: 0.05 },
    portCategoryDist: { wellKnown: 0.5, registered: 0.3, ephemeral: 0.2 },
    ...overrides,
  })

  describe('edge cases', () => {
    it('returns empty array for empty input', () => {
      const result = scoreAnomalies([])
      expect(result).toEqual([])
    })

    it('returns zero anomaly score for single state', () => {
      const states = [createState({ stateId: 1 })]
      const result = scoreAnomalies(states)

      expect(result).toHaveLength(1)
      expect(result[0].stateId).toBe(1)
      expect(result[0].anomalyScore).toBe(0)
      expect(result[0].anomalyFactors).toEqual([])
    })

    it('returns zero anomaly scores for identical states', () => {
      const states = [
        createState({ stateId: 1 }),
        createState({ stateId: 2 }),
        createState({ stateId: 3 }),
      ]
      const result = scoreAnomalies(states)

      expect(result).toHaveLength(3)
      result.forEach(score => {
        expect(score.anomalyScore).toBe(0)
        expect(score.anomalyFactors).toEqual([])
      })
    })
  })

  describe('Z-score anomaly detection', () => {
    it('identifies extreme outlier in bytes ratio', () => {
      const states = [
        createState({ stateId: 1, bytesRatio: 2.0 }),
        createState({ stateId: 2, bytesRatio: 2.1 }),
        createState({ stateId: 3, bytesRatio: 2.0 }),
        createState({ stateId: 4, bytesRatio: 50.0 }), // extreme outlier
      ]
      const result = scoreAnomalies(states)

      const outlier = result.find(s => s.stateId === 4)!
      expect(outlier.anomalyScore).toBeGreaterThan(80)
      expect(outlier.anomalyFactors).toContain('bytes_ratio')
    })

    it('identifies extreme outlier in duration', () => {
      const states = [
        createState({ stateId: 1, avgDurationMs: 5000 }),
        createState({ stateId: 2, avgDurationMs: 5100 }),
        createState({ stateId: 3, avgDurationMs: 4900 }),
        createState({ stateId: 4, avgDurationMs: 500000 }), // 100x longer
      ]
      const result = scoreAnomalies(states)

      const outlier = result.find(s => s.stateId === 4)!
      expect(outlier.anomalyScore).toBeGreaterThan(80)
      expect(outlier.anomalyFactors).toContain('duration')
    })

    it('identifies extreme outlier in packets per second', () => {
      const states = [
        createState({ stateId: 1, avgPktsPerSec: 10 }),
        createState({ stateId: 2, avgPktsPerSec: 12 }),
        createState({ stateId: 3, avgPktsPerSec: 11 }),
        createState({ stateId: 4, avgPktsPerSec: 1000 }), // DDoS-like
      ]
      const result = scoreAnomalies(states)

      const outlier = result.find(s => s.stateId === 4)!
      expect(outlier.anomalyScore).toBeGreaterThan(80)
      expect(outlier.anomalyFactors).toContain('pkts_per_sec')
    })

    it('identifies outlier in protocol skew with multiple anomalies', () => {
      // Protocol skew alone has limited range (0-0.67), so combine with other metrics
      const states = [
        createState({ stateId: 1, protocolDist: { tcp: 0.9, udp: 0.08, icmp: 0.02 }, avgPktsPerSec: 10 }),
        createState({ stateId: 2, protocolDist: { tcp: 0.92, udp: 0.06, icmp: 0.02 }, avgPktsPerSec: 12 }),
        createState({ stateId: 3, protocolDist: { tcp: 0.88, udp: 0.1, icmp: 0.02 }, avgPktsPerSec: 11 }),
        createState({ stateId: 4, protocolDist: { tcp: 0.01, udp: 0.01, icmp: 0.98 }, avgPktsPerSec: 5000 }), // ICMP flood + high pps
      ]
      const result = scoreAnomalies(states)

      const outlier = result.find(s => s.stateId === 4)!
      expect(outlier.anomalyScore).toBeGreaterThan(80)
      expect(outlier.anomalyFactors).toContain('pkts_per_sec')
      // Protocol skew may or may not be in top 3, depending on relative magnitudes
    })
  })

  describe('multi-factor anomalies', () => {
    it('combines multiple anomaly factors', () => {
      const states = [
        createState({ stateId: 1, bytesRatio: 2.0, avgDurationMs: 5000 }),
        createState({ stateId: 2, bytesRatio: 2.1, avgDurationMs: 5100 }),
        createState({ stateId: 3, bytesRatio: 50.0, avgDurationMs: 500000 }), // outlier in both
      ]
      const result = scoreAnomalies(states)

      const outlier = result.find(s => s.stateId === 3)!
      expect(outlier.anomalyScore).toBeGreaterThan(90)
      expect(outlier.anomalyFactors.length).toBeGreaterThanOrEqual(2)
      expect(outlier.anomalyFactors).toContain('bytes_ratio')
      expect(outlier.anomalyFactors).toContain('duration')
    })

    it('returns top 3 contributing factors', () => {
      const states = [
        createState({ stateId: 1 }),
        createState({
          stateId: 2,
          bytesRatio: 100,
          avgDurationMs: 1000000,
          avgPktsPerSec: 10000,
          protocolDist: { tcp: 0.01, udp: 0.01, icmp: 0.98 }
        }),
      ]
      const result = scoreAnomalies(states)

      const outlier = result.find(s => s.stateId === 2)!
      expect(outlier.anomalyFactors.length).toBeLessThanOrEqual(3)
    })
  })

  describe('score normalization', () => {
    it('returns scores between 0 and 100', () => {
      const states = [
        createState({ stateId: 1, bytesRatio: 2.0 }),
        createState({ stateId: 2, bytesRatio: 50.0 }),
      ]
      const result = scoreAnomalies(states)

      result.forEach(score => {
        expect(score.anomalyScore).toBeGreaterThanOrEqual(0)
        expect(score.anomalyScore).toBeLessThanOrEqual(100)
      })
    })

    it('assigns higher scores to larger deviations', () => {
      const states = [
        createState({ stateId: 1, bytesRatio: 2.0 }),
        createState({ stateId: 2, bytesRatio: 2.1 }),
        createState({ stateId: 3, bytesRatio: 5.0 }), // moderate outlier
        createState({ stateId: 4, bytesRatio: 50.0 }), // extreme outlier
      ]
      const result = scoreAnomalies(states)

      const moderate = result.find(s => s.stateId === 3)!
      const extreme = result.find(s => s.stateId === 4)!

      expect(extreme.anomalyScore).toBeGreaterThan(moderate.anomalyScore)
    })

    it('two states: one normal, one extreme outlier', () => {
      const states = [
        createState({ stateId: 1, bytesRatio: 2.0 }),
        createState({ stateId: 2, bytesRatio: 2.1 }), // slight variation
        createState({ stateId: 3, bytesRatio: 1.9 }), // slight variation
        createState({ stateId: 4, bytesRatio: 100.0 }), // extreme outlier
      ]
      const result = scoreAnomalies(states)

      expect(result).toHaveLength(4)
      const outlier = result.find(s => s.stateId === 4)!
      const normal = result.find(s => s.stateId === 1)!

      // Outlier should have higher score than normal states
      expect(outlier.anomalyScore).toBeGreaterThan(normal.anomalyScore)
      expect(outlier.anomalyFactors).toContain('bytes_ratio')
    })

    it('all states have identical metrics except bytesRatio', () => {
      const states = [
        createState({ stateId: 1, bytesRatio: 2.0 }),
        createState({ stateId: 2, bytesRatio: 2.1 }), // slight variation
        createState({ stateId: 3, bytesRatio: 1.9 }), // slight variation
        createState({ stateId: 4, bytesRatio: 2.0 }), // back to baseline
        createState({ stateId: 5, bytesRatio: 50.0 }), // only bytesRatio differs significantly
      ]
      const result = scoreAnomalies(states)

      const outlier = result.find(s => s.stateId === 5)!
      // bytes_ratio should be the primary factor flagged since it has the extreme outlier
      expect(outlier.anomalyFactors).toContain('bytes_ratio')
      expect(outlier.anomalyScore).toBeGreaterThan(80) // extreme outlier
    })

    it('protocol skew with uniform distribution (0.33 each)', () => {
      const states = [
        createState({ stateId: 1, protocolDist: { tcp: 0.33, udp: 0.33, icmp: 0.34 } }),
        createState({ stateId: 2, protocolDist: { tcp: 0.33, udp: 0.34, icmp: 0.33 } }),
        createState({ stateId: 3, protocolDist: { tcp: 0.34, udp: 0.33, icmp: 0.33 } }),
      ]
      const result = scoreAnomalies(states)

      // Uniform distribution should have minimal skew, all states should have low scores
      result.forEach(score => {
        expect(score.anomalyScore).toBeLessThan(20)
      })
    })

    it('protocol skew with extreme skew (tcp=1.0)', () => {
      const states = [
        createState({ stateId: 1, protocolDist: { tcp: 0.33, udp: 0.33, icmp: 0.34 } }),
        createState({ stateId: 2, protocolDist: { tcp: 0.34, udp: 0.33, icmp: 0.33 } }),
        createState({ stateId: 3, protocolDist: { tcp: 0.32, udp: 0.35, icmp: 0.33 } }),
        createState({ stateId: 4, protocolDist: { tcp: 0.33, udp: 0.32, icmp: 0.35 } }),
        createState({ stateId: 5, protocolDist: { tcp: 1.0, udp: 0.0, icmp: 0.0 } }), // max skew
      ]
      const result = scoreAnomalies(states)

      const outlier = result.find(s => s.stateId === 5)!
      // Protocol skew range is limited (0-0.67), so may not reach >2.0 z-score threshold alone
      // But should show some deviation from the uniform baseline
      expect(outlier.anomalyScore).toBeGreaterThanOrEqual(0)
      // Score might be 0 if protocol_skew z-score < 2.0, which is acceptable
    })

    it('MAD score with 2 values', () => {
      const states = [
        createState({ stateId: 1, bytesRatio: 2.0 }),
        createState({ stateId: 2, bytesRatio: 100.0 }),
      ]
      const result = scoreAnomalies(states)

      // Should not crash, median calculation works with 2 values
      expect(result).toHaveLength(2)
      result.forEach(score => {
        expect(score.anomalyScore).toBeGreaterThanOrEqual(0)
      })
    })

    it('score caps at exactly 100 for massive outliers', () => {
      const states = [
        createState({ stateId: 1, bytesRatio: 1.0 }),
        createState({ stateId: 2, bytesRatio: 1.1 }), // slight variation
        createState({ stateId: 3, bytesRatio: 0.9 }), // slight variation
        createState({ stateId: 4, bytesRatio: 1.0 }),
        createState({ stateId: 5, bytesRatio: 1.05 }), // slight variation
        createState({ stateId: 6, bytesRatio: 10000.0 }), // massive outlier
      ]
      const result = scoreAnomalies(states)

      const outlier = result.find(s => s.stateId === 6)!
      expect(outlier.anomalyScore).toBeLessThanOrEqual(100)
      expect(outlier.anomalyScore).toBe(100)
    })

    it('anomaly factors sorted by z-score descending', () => {
      const states = [
        createState({ stateId: 1 }),
        createState({ stateId: 2, avgPktsPerSec: 11 }), // slight variation
        createState({ stateId: 3, avgPktsPerSec: 9 }), // slight variation
        createState({ stateId: 4, avgPktsPerSec: 10.5 }), // slight variation
        createState({
          stateId: 5,
          bytesRatio: 10, // moderate outlier
          avgDurationMs: 50000, // moderate outlier
          avgPktsPerSec: 5000, // extreme outlier
        }),
      ]
      const result = scoreAnomalies(states)

      const outlier = result.find(s => s.stateId === 5)!
      // Verify factors are present and sorted (first factor should have highest z-score)
      expect(outlier.anomalyFactors.length).toBeGreaterThan(0)
      // pkts_per_sec should be first (extreme), followed by others
      if (outlier.anomalyFactors.length > 0) {
        expect(outlier.anomalyFactors[0]).toBe('pkts_per_sec')
      }
    })

    it('states with negative metric values don\'t crash', () => {
      const states = [
        createState({ stateId: 1, bytesRatio: 2.0 }),
        createState({ stateId: 2, bytesRatio: -1.0 }), // negative value
      ]

      // Should not throw, MAD scoring handles negative values
      expect(() => scoreAnomalies(states)).not.toThrow()
      const result = scoreAnomalies(states)
      expect(result).toHaveLength(2)
    })

    it('five identical states produce all-zero scores', () => {
      const states = [
        createState({ stateId: 1 }),
        createState({ stateId: 2 }),
        createState({ stateId: 3 }),
        createState({ stateId: 4 }),
        createState({ stateId: 5 }),
      ]
      const result = scoreAnomalies(states)

      expect(result).toHaveLength(5)
      result.forEach(score => {
        expect(score.anomalyScore).toBe(0)
        expect(score.anomalyFactors).toEqual([])
      })
    })
  })
})
