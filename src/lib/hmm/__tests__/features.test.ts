import { describe, it, expect } from 'vitest'
import { extractFlowFeatures, StandardScaler, FEATURE_NAMES } from '../features'
import type { FlowFeatures } from '../features'

describe('FEATURE_NAMES', () => {
  it('has exactly 16 feature names', () => {
    expect(FEATURE_NAMES).toHaveLength(16)
  })

  it('contains expected feature names', () => {
    expect(FEATURE_NAMES).toContain('log1p_in_bytes')
    expect(FEATURE_NAMES).toContain('bytes_ratio')
    expect(FEATURE_NAMES).toContain('is_tcp')
    expect(FEATURE_NAMES).toContain('port_category')
    expect(FEATURE_NAMES).toContain('is_conn_complete')
    expect(FEATURE_NAMES).toContain('is_conn_rejected')
    expect(FEATURE_NAMES).toContain('log1p_bytes_per_pkt')
    expect(FEATURE_NAMES).toContain('log1p_inter_flow_gap')
  })
})

describe('extractFlowFeatures', () => {
  const baseFlow: FlowFeatures = {
    IN_BYTES: 1000,
    OUT_BYTES: 500,
    IN_PKTS: 10,
    OUT_PKTS: 5,
    FLOW_DURATION_MILLISECONDS: 5000,
    PROTOCOL: 6,
    L4_DST_PORT: 443,
  }

  it('returns an array of 16 features', () => {
    const features = extractFlowFeatures(baseFlow)
    expect(features).toHaveLength(16)
  })

  it('computes log1p_in_bytes correctly', () => {
    const features = extractFlowFeatures(baseFlow)
    expect(features[0]).toBeCloseTo(Math.log1p(1000), 10)
  })

  it('computes log1p_out_bytes correctly', () => {
    const features = extractFlowFeatures(baseFlow)
    expect(features[1]).toBeCloseTo(Math.log1p(500), 10)
  })

  it('computes log1p_in_pkts correctly', () => {
    const features = extractFlowFeatures(baseFlow)
    expect(features[2]).toBeCloseTo(Math.log1p(10), 10)
  })

  it('computes log1p_out_pkts correctly', () => {
    const features = extractFlowFeatures(baseFlow)
    expect(features[3]).toBeCloseTo(Math.log1p(5), 10)
  })

  it('computes log1p_duration_ms correctly', () => {
    const features = extractFlowFeatures(baseFlow)
    expect(features[4]).toBeCloseTo(Math.log1p(5000), 10)
  })

  it('computes log1p_iat_avg correctly with default 0', () => {
    const features = extractFlowFeatures(baseFlow)
    // SRC_TO_DST_IAT_AVG is undefined, so log1p(0) = 0
    expect(features[5]).toBeCloseTo(0, 10)
  })

  it('computes log1p_iat_avg with provided value', () => {
    const flow: FlowFeatures = { ...baseFlow, SRC_TO_DST_IAT_AVG: 250 }
    const features = extractFlowFeatures(flow)
    expect(features[5]).toBeCloseTo(Math.log1p(250), 10)
  })

  it('computes bytes_ratio correctly', () => {
    const features = extractFlowFeatures(baseFlow)
    // IN_BYTES / (OUT_BYTES + 1) = 1000 / 501
    expect(features[6]).toBeCloseTo(1000 / 501, 10)
  })

  it('computes pkts_per_second correctly', () => {
    const features = extractFlowFeatures(baseFlow)
    // (10 + 5) / max(5000 / 1000, 0.001) = 15 / 5 = 3
    expect(features[7]).toBeCloseTo(3, 10)
  })

  it('computes pkts_per_second with very short duration', () => {
    const flow: FlowFeatures = { ...baseFlow, FLOW_DURATION_MILLISECONDS: 0 }
    const features = extractFlowFeatures(flow)
    // (10 + 5) / max(0, 0.001) = 15 / 0.001 = 15000
    expect(features[7]).toBeCloseTo(15000, 5)
  })

  it('sets is_tcp=1 for TCP protocol (6)', () => {
    const features = extractFlowFeatures(baseFlow)
    expect(features[8]).toBe(1)
    expect(features[9]).toBe(0)
    expect(features[10]).toBe(0)
  })

  it('sets is_udp=1 for UDP protocol (17)', () => {
    const flow: FlowFeatures = { ...baseFlow, PROTOCOL: 17 }
    const features = extractFlowFeatures(flow)
    expect(features[8]).toBe(0)
    expect(features[9]).toBe(1)
    expect(features[10]).toBe(0)
  })

  it('sets is_icmp=1 for ICMP protocol (1)', () => {
    const flow: FlowFeatures = { ...baseFlow, PROTOCOL: 1 }
    const features = extractFlowFeatures(flow)
    expect(features[8]).toBe(0)
    expect(features[9]).toBe(0)
    expect(features[10]).toBe(1)
  })

  it('sets all protocol flags to 0 for unknown protocol', () => {
    const flow: FlowFeatures = { ...baseFlow, PROTOCOL: 47 }
    const features = extractFlowFeatures(flow)
    expect(features[8]).toBe(0)
    expect(features[9]).toBe(0)
    expect(features[10]).toBe(0)
  })

  it('categorizes well-known ports (0-1023) as 0', () => {
    const flow: FlowFeatures = { ...baseFlow, L4_DST_PORT: 80 }
    const features = extractFlowFeatures(flow)
    expect(features[11]).toBe(0)
  })

  it('categorizes registered ports (1024-49151) as 1', () => {
    const flow: FlowFeatures = { ...baseFlow, L4_DST_PORT: 8080 }
    const features = extractFlowFeatures(flow)
    expect(features[11]).toBe(1)
  })

  it('categorizes ephemeral ports (49152+) as 2', () => {
    const flow: FlowFeatures = { ...baseFlow, L4_DST_PORT: 55000 }
    const features = extractFlowFeatures(flow)
    expect(features[11]).toBe(2)
  })

  it('treats port 1023 as well-known (boundary)', () => {
    const flow: FlowFeatures = { ...baseFlow, L4_DST_PORT: 1023 }
    const features = extractFlowFeatures(flow)
    expect(features[11]).toBe(0)
  })

  it('treats port 1024 as registered (boundary)', () => {
    const flow: FlowFeatures = { ...baseFlow, L4_DST_PORT: 1024 }
    const features = extractFlowFeatures(flow)
    expect(features[11]).toBe(1)
  })

  it('treats port 49151 as registered (boundary)', () => {
    const flow: FlowFeatures = { ...baseFlow, L4_DST_PORT: 49151 }
    const features = extractFlowFeatures(flow)
    expect(features[11]).toBe(1)
  })

  it('treats port 49152 as ephemeral (boundary)', () => {
    const flow: FlowFeatures = { ...baseFlow, L4_DST_PORT: 49152 }
    const features = extractFlowFeatures(flow)
    expect(features[11]).toBe(2)
  })

  it('handles zero bytes gracefully', () => {
    const flow: FlowFeatures = { ...baseFlow, IN_BYTES: 0, OUT_BYTES: 0 }
    const features = extractFlowFeatures(flow)
    expect(features[0]).toBeCloseTo(0, 10)     // log1p(0) = 0
    expect(features[1]).toBeCloseTo(0, 10)     // log1p(0) = 0
    expect(features[6]).toBeCloseTo(0, 10)     // 0 / (0 + 1) = 0
  })

  it('sets is_conn_complete=1 when CONN_STATE is SF', () => {
    const flow: FlowFeatures = { ...baseFlow, CONN_STATE: 'SF' }
    const features = extractFlowFeatures(flow)
    expect(features[12]).toBe(1)
  })

  it('sets is_conn_complete=0 when CONN_STATE is not SF', () => {
    const flow: FlowFeatures = { ...baseFlow, CONN_STATE: 'S0' }
    const features = extractFlowFeatures(flow)
    expect(features[12]).toBe(0)
  })

  it('sets is_conn_rejected=1 when CONN_STATE is S0', () => {
    const flow: FlowFeatures = { ...baseFlow, CONN_STATE: 'S0' }
    const features = extractFlowFeatures(flow)
    expect(features[13]).toBe(1)
  })

  it('sets is_conn_rejected=1 when CONN_STATE is REJ', () => {
    const flow: FlowFeatures = { ...baseFlow, CONN_STATE: 'REJ' }
    const features = extractFlowFeatures(flow)
    expect(features[13]).toBe(1)
  })

  it('sets is_conn_rejected=0 when CONN_STATE is SF', () => {
    const flow: FlowFeatures = { ...baseFlow, CONN_STATE: 'SF' }
    const features = extractFlowFeatures(flow)
    expect(features[13]).toBe(0)
  })

  it('computes log1p_bytes_per_pkt correctly', () => {
    // (1000 + 500) / max(10 + 5, 1) = 1500 / 15 = 100
    const features = extractFlowFeatures(baseFlow)
    expect(features[14]).toBeCloseTo(Math.log1p(100), 10)
  })

  it('handles zero packets in log1p_bytes_per_pkt', () => {
    const flow: FlowFeatures = { ...baseFlow, IN_PKTS: 0, OUT_PKTS: 0 }
    const features = extractFlowFeatures(flow)
    // (1000 + 500) / max(0, 1) = 1500
    expect(features[14]).toBeCloseTo(Math.log1p(1500), 10)
  })

  it('defaults log1p_inter_flow_gap to 0 when not provided', () => {
    const features = extractFlowFeatures(baseFlow)
    expect(features[15]).toBeCloseTo(0, 10)
  })

  it('computes log1p_inter_flow_gap when INTER_FLOW_GAP_MS is provided', () => {
    const flow: FlowFeatures = { ...baseFlow, INTER_FLOW_GAP_MS: 5000 }
    const features = extractFlowFeatures(flow)
    expect(features[15]).toBeCloseTo(Math.log1p(5000), 10)
  })

  it('defaults is_conn_complete and is_conn_rejected to 0 when CONN_STATE not provided', () => {
    const features = extractFlowFeatures(baseFlow)
    expect(features[12]).toBe(0)
    expect(features[13]).toBe(0)
  })
})

describe('StandardScaler', () => {
  it('fit computes mean and std', () => {
    const scaler = new StandardScaler()
    const data = [
      [1, 2],
      [3, 4],
      [5, 6],
    ]
    scaler.fit(data)
    const transformed = scaler.transform(data)

    // Mean of [1,3,5] = 3, std = sqrt(8/3)
    // (1 - 3) / std = -2 / std
    expect(transformed).toHaveLength(3)
    expect(transformed[0]).toHaveLength(2)
  })

  it('transform standardizes to zero mean and unit variance', () => {
    const scaler = new StandardScaler()
    const data = [
      [10, 20],
      [20, 40],
      [30, 60],
    ]
    scaler.fit(data)
    const result = scaler.transform(data)

    // Check zero mean
    const col0Mean = result.reduce((s, r) => s + r[0], 0) / result.length
    const col1Mean = result.reduce((s, r) => s + r[1], 0) / result.length
    expect(col0Mean).toBeCloseTo(0, 10)
    expect(col1Mean).toBeCloseTo(0, 10)

    // Check unit variance (population std)
    const col0Var = result.reduce((s, r) => s + r[0] ** 2, 0) / result.length
    const col1Var = result.reduce((s, r) => s + r[1] ** 2, 0) / result.length
    expect(col0Var).toBeCloseTo(1, 10)
    expect(col1Var).toBeCloseTo(1, 10)
  })

  it('fitTransform is equivalent to fit then transform', () => {
    const data = [
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
    ]

    const scaler1 = new StandardScaler()
    const result1 = scaler1.fitTransform(data)

    const scaler2 = new StandardScaler()
    scaler2.fit(data)
    const result2 = scaler2.transform(data)

    for (let i = 0; i < result1.length; i++) {
      for (let j = 0; j < result1[i].length; j++) {
        expect(result1[i][j]).toBeCloseTo(result2[i][j], 10)
      }
    }
  })

  it('handles constant features (zero variance) without NaN', () => {
    const scaler = new StandardScaler()
    const data = [
      [5, 1],
      [5, 2],
      [5, 3],
    ]
    scaler.fit(data)
    const result = scaler.transform(data)

    // Constant column should become all zeros, not NaN
    for (const row of result) {
      expect(Number.isNaN(row[0])).toBe(false)
      expect(row[0]).toBe(0)
    }
  })

  it('throws if transform called before fit', () => {
    const scaler = new StandardScaler()
    expect(() => scaler.transform([[1, 2]])).toThrow()
  })

  it('throws if toJSON called before fit', () => {
    const scaler = new StandardScaler()
    expect(() => scaler.toJSON()).toThrow()
  })

  it('throws if fit called with empty data', () => {
    const scaler = new StandardScaler()
    expect(() => scaler.fit([])).toThrow()
  })

  it('serializes and deserializes correctly', () => {
    const scaler = new StandardScaler()
    const data = [[1, 2], [3, 4], [5, 6]]
    scaler.fit(data)

    const json = scaler.toJSON()
    const restored = StandardScaler.fromJSON(json)
    const result1 = scaler.transform([[10, 20]])
    const result2 = restored.transform([[10, 20]])

    for (let j = 0; j < result1[0].length; j++) {
      expect(result1[0][j]).toBeCloseTo(result2[0][j], 10)
    }
  })
})
