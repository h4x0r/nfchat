/**
 * Feature extraction utilities for HMM-based network flow analysis.
 *
 * Extracts 12 features per flow matching the Python implementation
 * in scripts/hmm/features/extractor.py.
 */

export const FEATURE_NAMES = [
  'log1p_in_bytes',
  'log1p_out_bytes',
  'log1p_in_pkts',
  'log1p_out_pkts',
  'log1p_duration_ms',
  'log1p_iat_avg',
  'bytes_ratio',
  'pkts_per_second',
  'is_tcp',
  'is_udp',
  'is_icmp',
  'port_category',
  'is_conn_complete',
  'is_conn_rejected',
  'log1p_bytes_per_pkt',
  'log1p_inter_flow_gap',
] as const

export type FeatureName = (typeof FEATURE_NAMES)[number]

export interface FlowFeatures {
  IN_BYTES: number
  OUT_BYTES: number
  IN_PKTS: number
  OUT_PKTS: number
  FLOW_DURATION_MILLISECONDS: number
  PROTOCOL: number
  L4_DST_PORT: number
  SRC_TO_DST_IAT_AVG?: number
  CONN_STATE?: string
  INTER_FLOW_GAP_MS?: number
}

// Protocol constants
const PROTO_TCP = 6
const PROTO_UDP = 17
const PROTO_ICMP = 1

// Connection states indicating rejected/failed/scan flows
const REJECTED_STATES = new Set(['REJ', 'RSTO', 'RSTR', 'S0'])

/**
 * Extract 16 numeric features from a single network flow.
 *
 * Feature order matches FEATURE_NAMES:
 *  [0] log1p_in_bytes
 *  [1] log1p_out_bytes
 *  [2] log1p_in_pkts
 *  [3] log1p_out_pkts
 *  [4] log1p_duration_ms
 *  [5] log1p_iat_avg
 *  [6] bytes_ratio
 *  [7] pkts_per_second
 *  [8] is_tcp
 *  [9] is_udp
 * [10] is_icmp
 * [11] port_category
 * [12] is_conn_complete
 * [13] is_conn_rejected
 * [14] log1p_bytes_per_pkt
 * [15] log1p_inter_flow_gap
 */
export function extractFlowFeatures(flow: FlowFeatures): number[] {
  const features = new Array<number>(16)

  // Volume features (log-scaled)
  features[0] = Math.log1p(flow.IN_BYTES)
  features[1] = Math.log1p(flow.OUT_BYTES)
  features[2] = Math.log1p(flow.IN_PKTS)
  features[3] = Math.log1p(flow.OUT_PKTS)

  // Temporal features
  features[4] = Math.log1p(flow.FLOW_DURATION_MILLISECONDS)
  features[5] = Math.log1p(flow.SRC_TO_DST_IAT_AVG || 0)

  // Derived ratios
  features[6] = flow.IN_BYTES / (flow.OUT_BYTES + 1)

  // Packets per second (handle zero duration)
  const totalPkts = flow.IN_PKTS + flow.OUT_PKTS
  const durationS = Math.max(flow.FLOW_DURATION_MILLISECONDS / 1000, 0.001)
  features[7] = totalPkts / durationS

  // Protocol one-hot encoding
  features[8] = flow.PROTOCOL === PROTO_TCP ? 1 : 0
  features[9] = flow.PROTOCOL === PROTO_UDP ? 1 : 0
  features[10] = flow.PROTOCOL === PROTO_ICMP ? 1 : 0

  // Port category: 0=well-known, 1=registered, 2=ephemeral
  features[11] = portCategory(flow.L4_DST_PORT)

  // Connection state indicators
  const connState = flow.CONN_STATE ?? ''
  features[12] = connState === 'SF' ? 1 : 0
  features[13] = REJECTED_STATES.has(connState) ? 1 : 0

  // Bytes per packet (log-scaled)
  const totalBytes = flow.IN_BYTES + flow.OUT_BYTES
  features[14] = Math.log1p(totalBytes / Math.max(totalPkts, 1))

  // Inter-flow gap (log-scaled, defaults to 0 if not provided)
  features[15] = Math.log1p(flow.INTER_FLOW_GAP_MS ?? 0)

  return features
}

function portCategory(port: number): number {
  if (port <= 1023) return 0
  if (port <= 49151) return 1
  return 2
}

/**
 * StandardScaler: zero-mean, unit-variance normalization.
 *
 * Uses population standard deviation (matching sklearn's default behavior)
 * to be consistent with the Python pipeline.
 */
export class StandardScaler {
  private mean_: number[] | null = null
  private std_: number[] | null = null

  /** Compute mean and std from training data. */
  fit(data: number[][]): void {
    const n = data.length
    if (n === 0) {
      throw new Error('Cannot fit StandardScaler on empty data')
    }

    const nFeatures = data[0].length
    const mean = new Array<number>(nFeatures).fill(0)
    const variance = new Array<number>(nFeatures).fill(0)

    // Compute mean
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < nFeatures; j++) {
        mean[j] += data[i][j]
      }
    }
    for (let j = 0; j < nFeatures; j++) {
      mean[j] /= n
    }

    // Compute population variance
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < nFeatures; j++) {
        const diff = data[i][j] - mean[j]
        variance[j] += diff * diff
      }
    }

    const std = new Array<number>(nFeatures)
    for (let j = 0; j < nFeatures; j++) {
      variance[j] /= n
      std[j] = Math.sqrt(variance[j])
    }

    this.mean_ = mean
    this.std_ = std
  }

  /** Transform data using previously fitted mean/std. */
  transform(data: number[][]): number[][] {
    if (this.mean_ === null || this.std_ === null) {
      throw new Error('StandardScaler has not been fitted. Call fit() first.')
    }

    const mean = this.mean_
    const std = this.std_
    const result: number[][] = new Array(data.length)

    for (let i = 0; i < data.length; i++) {
      const row = new Array<number>(data[i].length)
      for (let j = 0; j < data[i].length; j++) {
        // If std is 0, output 0 (constant feature)
        if (std[j] === 0) {
          row[j] = 0
        } else {
          row[j] = (data[i][j] - mean[j]) / std[j]
        }
      }
      result[i] = row
    }

    return result
  }

  /** Fit and transform in one step. */
  fitTransform(data: number[][]): number[][] {
    this.fit(data)
    return this.transform(data)
  }

  /** Serialize to a plain object. */
  toJSON(): { mean: number[]; std: number[] } {
    if (this.mean_ === null || this.std_ === null) {
      throw new Error('StandardScaler has not been fitted. Call fit() first.')
    }
    return {
      mean: [...this.mean_],
      std: [...this.std_],
    }
  }

  /** Restore from a plain object. */
  static fromJSON(json: { mean: number[]; std: number[] }): StandardScaler {
    const scaler = new StandardScaler()
    scaler.mean_ = [...json.mean]
    scaler.std_ = [...json.std]
    return scaler
  }
}
