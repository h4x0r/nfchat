/**
 * Bridge API for the HMM Web Worker.
 *
 * Wraps Worker postMessage/onmessage into a Promise-based API.
 * Falls back to synchronous execution when Worker is unavailable (e.g. SSR or tests).
 */

import { GaussianHMM } from './gaussian-hmm'
import { StandardScaler } from './features'
import type { WorkerOutMessage } from './hmm-worker'

export interface TrainResult {
  states: number[]
  nStates: number
  converged: boolean
  iterations: number
  logLikelihood: number
}

function trainSynchronously(
  matrix: number[][],
  requestedStates: number,
  onProgress?: (percent: number, phase: string) => void,
  groupIds?: string[],
): TrainResult {
  onProgress?.(10, 'scaling')
  const scaler = new StandardScaler()
  const scaled = scaler.fitTransform(matrix)
  const nFeatures = scaled[0].length

  onProgress?.(20, 'scaling')

  let nStates: number
  if (requestedStates > 0) {
    nStates = requestedStates
  } else {
    onProgress?.(25, 'bic-selection')
    let bestBic = Infinity
    nStates = 2
    let consecutiveIncreases = 0

    // Subsample for BIC scoring if data is large
    const bicData = scaled.length > 15000 ? scaled.slice(0, 10000) : scaled

    for (let k = 2; k <= 10; k++) {
      const candidate = new GaussianHMM(k, nFeatures, { maxIter: 10, tol: 0.1, seed: 42 })
      candidate.fit([bicData])
      const bic = candidate.bic([bicData])
      if (bic < bestBic) {
        bestBic = bic
        nStates = k
        consecutiveIncreases = 0
      } else {
        consecutiveIncreases++
        if (consecutiveIncreases >= 2) break
      }
      const bicProgress = 25 + Math.round(((k - 1) / 8) * 15)
      onProgress?.(bicProgress, 'bic-selection')
    }
  }

  onProgress?.(40, 'training')

  // Split into per-group sequences if groupIds provided
  const sequences = buildSequences(scaled, groupIds)

  const hmm = new GaussianHMM(nStates, nFeatures, { maxIter: 50, tol: 1e-2, seed: 42 })
  const fitResult = hmm.fit(sequences, {
    onProgress: (iter, maxIter) => {
      const percent = 40 + Math.round((iter / maxIter) * 40)
      onProgress?.(percent, 'training')
    },
  })

  onProgress?.(80, 'predicting')

  // Predict per-sequence, reassemble in original row order
  const states = predictAndReassemble(hmm, scaled, groupIds)

  return {
    states,
    nStates,
    converged: fitResult.converged,
    iterations: fitResult.iterations,
    logLikelihood: fitResult.logLikelihood,
  }
}

/**
 * Build per-group sequences from a flat scaled matrix.
 * If no groupIds, returns the full matrix as a single sequence.
 */
function buildSequences(scaled: number[][], groupIds?: string[]): number[][][] {
  if (!groupIds) return [scaled]

  const groupMap = new Map<string, number[][]>()
  for (let i = 0; i < scaled.length; i++) {
    const gid = groupIds[i]
    let group = groupMap.get(gid)
    if (!group) {
      group = []
      groupMap.set(gid, group)
    }
    group.push(scaled[i])
  }
  return Array.from(groupMap.values())
}

/**
 * Predict per-sequence and reassemble states in original row order.
 */
function predictAndReassemble(
  hmm: GaussianHMM,
  scaled: number[][],
  groupIds?: string[],
): number[] {
  if (!groupIds) return hmm.predict(scaled)

  // Build index mapping: for each group, which original indices belong to it
  const groupIndices = new Map<string, number[]>()
  for (let i = 0; i < scaled.length; i++) {
    const gid = groupIds[i]
    let indices = groupIndices.get(gid)
    if (!indices) {
      indices = []
      groupIndices.set(gid, indices)
    }
    indices.push(i)
  }

  const states = new Array<number>(scaled.length)

  for (const [, indices] of groupIndices) {
    const seq = indices.map(i => scaled[i])
    const seqStates = hmm.predict(seq)
    for (let j = 0; j < indices.length; j++) {
      states[indices[j]] = seqStates[j]
    }
  }

  return states
}

/**
 * Train HMM in a Web Worker (or synchronously if Worker is unavailable).
 *
 * @param matrix - Feature matrix (rows = observations, cols = features)
 * @param requestedStates - Number of states to use (0 = auto-select via BIC)
 * @param onProgress - Optional progress callback (percent, phase)
 * @param groupIds - Optional per-row group identifiers for sequence splitting
 * @returns Promise with training result
 */
export function trainInWorker(
  matrix: number[][],
  requestedStates: number,
  onProgress?: (percent: number, phase: string) => void,
  groupIds?: string[],
): Promise<TrainResult> {
  // Fallback: if Worker is not available, run synchronously
  if (typeof Worker === 'undefined') {
    return Promise.resolve(trainSynchronously(matrix, requestedStates, onProgress, groupIds))
  }

  return new Promise<TrainResult>((resolve, reject) => {
    const worker = new Worker(
      new URL('./hmm-worker.ts', import.meta.url),
      { type: 'module' },
    )

    worker.onmessage = (e: MessageEvent<WorkerOutMessage>) => {
      const msg = e.data
      switch (msg.type) {
        case 'progress':
          onProgress?.(msg.percent, msg.phase)
          break
        case 'result':
          worker.terminate()
          resolve({
            states: msg.states,
            nStates: msg.nStates,
            converged: msg.converged,
            iterations: msg.iterations,
            logLikelihood: msg.logLikelihood,
          })
          break
        case 'error':
          worker.terminate()
          reject(new Error(msg.message))
          break
      }
    }

    worker.onerror = (e: ErrorEvent) => {
      worker.terminate()
      reject(new Error(e.message))
    }

    worker.postMessage({
      type: 'train',
      matrix,
      requestedStates,
      groupIds,
    })
  })
}
