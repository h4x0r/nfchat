/**
 * Web Worker for HMM training.
 *
 * Receives a feature matrix and requested state count,
 * performs scaling + BIC auto-selection + training + prediction,
 * and posts back progress updates and the final result.
 */

import { GaussianHMM } from './gaussian-hmm'
import { StandardScaler } from './features'

export interface TrainMessage {
  type: 'train'
  matrix: number[][]
  requestedStates: number
  groupIds?: string[]
}

export interface ProgressMessage {
  type: 'progress'
  percent: number
  phase: string
}

export interface ResultMessage {
  type: 'result'
  states: number[]
  nStates: number
  converged: boolean
  iterations: number
  logLikelihood: number
}

export interface ErrorMessage {
  type: 'error'
  message: string
}

export type WorkerOutMessage = ProgressMessage | ResultMessage | ErrorMessage

function postProgress(percent: number, phase: string) {
  self.postMessage({ type: 'progress', percent, phase } satisfies ProgressMessage)
}

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

function predictAndReassemble(
  hmm: GaussianHMM,
  scaled: number[][],
  groupIds?: string[],
): number[] {
  if (!groupIds) return hmm.predict(scaled)
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

self.onmessage = (e: MessageEvent<TrainMessage>) => {
  const { matrix, requestedStates, groupIds } = e.data

  try {
    // Scale features
    postProgress(10, 'scaling')
    const scaler = new StandardScaler()
    const scaled = scaler.fitTransform(matrix)
    const nFeatures = scaled[0].length

    postProgress(20, 'scaling')

    // Determine number of states
    let nStates: number
    if (requestedStates > 0) {
      nStates = requestedStates
    } else {
      // Auto-select via BIC over range 2-10 with early stopping
      postProgress(25, 'bic-selection')
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
        postProgress(bicProgress, 'bic-selection')
      }
    }

    postProgress(40, 'training')

    // Split into per-group sequences if groupIds provided
    const sequences = buildSequences(scaled, groupIds)

    // Train final model
    const hmm = new GaussianHMM(nStates, nFeatures, { maxIter: 50, tol: 1e-2, seed: 42 })
    const fitResult = hmm.fit(sequences, {
      onProgress: (iter, maxIter) => {
        const percent = 40 + Math.round((iter / maxIter) * 40)
        postProgress(percent, 'training')
      },
    })

    postProgress(80, 'predicting')

    // Predict per-sequence, reassemble in original row order
    const states = predictAndReassemble(hmm, scaled, groupIds)

    self.postMessage({
      type: 'result',
      states,
      nStates,
      converged: fitResult.converged,
      iterations: fitResult.iterations,
      logLikelihood: fitResult.logLikelihood,
    } satisfies ResultMessage)
  } catch (err) {
    self.postMessage({
      type: 'error',
      message: err instanceof Error ? err.message : 'HMM training failed in worker',
    } satisfies ErrorMessage)
  }
}
