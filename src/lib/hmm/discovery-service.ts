/**
 * HMM State Discovery Service
 *
 * Orchestrates the full HMM discovery workflow:
 * 1. Extract features from database
 * 2. Train HMM model via Web Worker
 * 3. Write state assignments back to database
 * 4. Generate state profiles
 * 5. Score anomalies and merge into profiles
 *
 * Extracted from StateExplorer/index.tsx handleDiscover() for testability and reusability.
 */

import { extractFeatures, ensureHmmStateColumn, writeStateAssignments, getStateSignatures } from '@/lib/motherduck/queries'
import { trainInWorker } from './worker-bridge'
import { scoreAnomalies } from './anomaly'
import { logger } from '@/lib/logger'
import type { StateProfile } from '@/lib/store/types'

const log = logger.child('DiscoveryService')

export interface DiscoveryOptions {
  requestedStates: number
  sampleSize: number
  onProgress: (percent: number) => void
}

export interface DiscoveryResult {
  profiles: StateProfile[]
  converged: boolean
  iterations: number
  logLikelihood: number
}

/**
 * Discover hidden states in network flow data using HMM.
 *
 * @param opts - Discovery configuration
 * @returns Discovery result with state profiles and training metadata
 * @throws Error if insufficient data for training
 */
export async function discoverStates(opts: DiscoveryOptions): Promise<DiscoveryResult> {
  const { requestedStates, sampleSize, onProgress } = opts

  log.info('Starting HMM discovery', { requestedStates, sampleSize })

  // Ensure HMM_STATE column exists
  log.info('Ensuring HMM_STATE column exists...')
  await ensureHmmStateColumn()
  log.info('HMM_STATE column ensured')

  // Extract features from a random sample of flows
  log.info('Extracting features...', { sampleSize })
  const featureRows = await extractFeatures(sampleSize)
  log.info('Features extracted', { rowCount: featureRows.length })
  if (featureRows.length < 10) {
    throw new Error('Insufficient data for training (need at least 10 flows)')
  }

  onProgress(10)

  // Convert to feature matrix (12 features per row)
  const matrix = featureRows.map((row) => [
    row.log1p_in_bytes,
    row.log1p_out_bytes,
    row.log1p_in_pkts,
    row.log1p_out_pkts,
    row.log1p_duration_ms,
    row.log1p_iat_avg,
    row.bytes_ratio,
    row.pkts_per_second,
    row.is_tcp,
    row.is_udp,
    row.is_icmp,
    row.port_category,
  ])

  // Extract per-destination group IDs for sequence splitting
  const groupIds = featureRows.map((r) => r.dst_ip)

  // Run scaling + BIC + training + prediction in worker
  const workerResult = await trainInWorker(matrix, requestedStates, (percent) => {
    onProgress(10 + Math.round(percent * 0.7))
  }, groupIds)

  onProgress(80)

  // Write state assignments back to DuckDB
  const assignments = new Map<number, number>()
  for (let i = 0; i < workerResult.states.length; i++) {
    assignments.set(featureRows[i].rowid, workerResult.states[i])
  }
  await writeStateAssignments(assignments)

  onProgress(90)

  // Get state signatures from DB
  const signatures = await getStateSignatures()

  // Build StateProfile objects (tactic assignment is left to the analyst)
  const profiles: StateProfile[] = signatures.map((sig) => ({
    stateId: sig.state_id,
    flowCount: sig.flow_count,
    avgInBytes: sig.avg_in_bytes,
    avgOutBytes: sig.avg_out_bytes,
    bytesRatio: sig.bytes_ratio,
    avgDurationMs: sig.avg_duration_ms,
    avgPktsPerSec: sig.avg_pkts_per_sec,
    protocolDist: { tcp: sig.tcp_pct, udp: sig.udp_pct, icmp: sig.icmp_pct },
    portCategoryDist: { wellKnown: sig.well_known_pct, registered: sig.registered_pct, ephemeral: sig.ephemeral_pct },
  }))

  // CRITICAL: Score anomalies and merge into profiles
  const anomalyScores = scoreAnomalies(profiles)
  anomalyScores.forEach((score) => {
    const profile = profiles.find((p) => p.stateId === score.stateId)
    if (profile) {
      profile.anomalyScore = score.anomalyScore
      profile.anomalyFactors = score.anomalyFactors
    }
  })

  log.info('Discovery complete', { nStates: profiles.length, converged: workerResult.converged })

  return {
    profiles,
    converged: workerResult.converged,
    iterations: workerResult.iterations,
    logLikelihood: workerResult.logLikelihood,
  }
}
