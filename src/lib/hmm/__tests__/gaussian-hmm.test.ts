import { describe, it, expect } from 'vitest'
import { GaussianHMM } from '../gaussian-hmm'

/**
 * Helper: generate synthetic sequences from a known 2-state model.
 * State 0: mean=[0,0], State 1: mean=[5,5].
 * Transitions: mostly self-loops.
 */
function generateSyntheticSequences(
  nSequences: number,
  seqLength: number,
  seed: number = 42,
): number[][][] {
  // Simple seeded PRNG (mulberry32)
  let s = seed
  function rand(): number {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  function randn(): number {
    const u1 = rand()
    const u2 = rand()
    return Math.sqrt(-2 * Math.log(u1 + 1e-10)) * Math.cos(2 * Math.PI * u2)
  }

  const means = [[0, 0], [5, 5]]
  const sequences: number[][][] = []

  for (let s = 0; s < nSequences; s++) {
    const seq: number[][] = []
    let state = rand() < 0.5 ? 0 : 1
    for (let t = 0; t < seqLength; t++) {
      const obs = means[state].map(m => m + randn() * 0.5)
      seq.push(obs)
      // Transition: 90% self-loop, 10% switch
      if (rand() < 0.1) {
        state = 1 - state
      }
    }
    sequences.push(seq)
  }
  return sequences
}

describe('GaussianHMM', () => {
  describe('constructor', () => {
    it('creates an HMM with default parameters', () => {
      const hmm = new GaussianHMM(3, 2)
      expect(hmm.nStates).toBe(3)
      expect(hmm.nFeatures).toBe(2)
    })

    it('accepts custom options', () => {
      const hmm = new GaussianHMM(5, 4, { maxIter: 50, tol: 1e-6, seed: 123 })
      expect(hmm.nStates).toBe(5)
      expect(hmm.nFeatures).toBe(4)
    })
  })

  describe('fit', () => {
    it('trains on synthetic 2-state data and converges', () => {
      const sequences = generateSyntheticSequences(5, 50)
      const hmm = new GaussianHMM(2, 2, { maxIter: 50, seed: 42 })
      const result = hmm.fit(sequences)

      expect(result.iterations).toBeGreaterThan(0)
      expect(result.iterations).toBeLessThanOrEqual(50)
      expect(typeof result.logLikelihood).toBe('number')
      expect(Number.isFinite(result.logLikelihood)).toBe(true)
    })

    it('improves log-likelihood over iterations', () => {
      const sequences = generateSyntheticSequences(5, 50)
      const hmm = new GaussianHMM(2, 2, { maxIter: 2, seed: 42 })
      const result1 = hmm.fit(sequences)

      const hmm2 = new GaussianHMM(2, 2, { maxIter: 30, seed: 42 })
      const result2 = hmm2.fit(sequences)

      // More iterations should give >= log-likelihood
      expect(result2.logLikelihood).toBeGreaterThanOrEqual(result1.logLikelihood - 1)
    })

    it('calls onProgress callback during training', () => {
      const sequences = generateSyntheticSequences(3, 30)
      const hmm = new GaussianHMM(2, 2, { maxIter: 5, seed: 42 })
      const progressValues: number[] = []

      hmm.fit(sequences, {
        onProgress: (iter, _maxIter, _ll) => {
          progressValues.push(iter)
        },
      })

      expect(progressValues.length).toBeGreaterThan(0)
      // First progress should be iteration 1
      expect(progressValues[0]).toBe(1)
    })

    it('throws if sequences are empty', () => {
      const hmm = new GaussianHMM(2, 2)
      expect(() => hmm.fit([])).toThrow()
    })

    it('throws if sequence has wrong feature dimension', () => {
      const hmm = new GaussianHMM(2, 3) // expects 3 features
      const sequences = [[[1, 2], [3, 4]]] // only 2 features
      expect(() => hmm.fit(sequences)).toThrow()
    })
  })

  describe('predict', () => {
    it('returns state assignments for each observation', () => {
      const sequences = generateSyntheticSequences(5, 50)
      const hmm = new GaussianHMM(2, 2, { maxIter: 30, seed: 42 })
      hmm.fit(sequences)

      const testSeq = sequences[0]
      const states = hmm.predict(testSeq)

      expect(states).toHaveLength(testSeq.length)
      // All states should be 0 or 1
      for (const s of states) {
        expect(s).toBeGreaterThanOrEqual(0)
        expect(s).toBeLessThan(2)
      }
    })

    it('assigns different states to clearly separated clusters', () => {
      const sequences = generateSyntheticSequences(5, 100, 42)
      const hmm = new GaussianHMM(2, 2, { maxIter: 50, seed: 42 })
      hmm.fit(sequences)

      // Create a test sequence: first half near [0,0], second half near [5,5]
      const testSeq: number[][] = []
      for (let i = 0; i < 20; i++) testSeq.push([0.1, 0.1])
      for (let i = 0; i < 20; i++) testSeq.push([4.9, 4.9])

      const states = hmm.predict(testSeq)

      // The first 20 should mostly be one state, last 20 another
      const firstHalfState = states[0]
      const secondHalfState = states[30]
      expect(firstHalfState).not.toBe(secondHalfState)

      // At least 80% of each half should be in its respective state
      const firstCorrect = states.slice(0, 20).filter(s => s === firstHalfState).length
      const secondCorrect = states.slice(20).filter(s => s === secondHalfState).length
      expect(firstCorrect).toBeGreaterThanOrEqual(16)
      expect(secondCorrect).toBeGreaterThanOrEqual(16)
    })

    it('throws if model is not fitted', () => {
      const hmm = new GaussianHMM(2, 2)
      expect(() => hmm.predict([[1, 2]])).toThrow()
    })
  })

  describe('bic', () => {
    it('returns a finite number', () => {
      const sequences = generateSyntheticSequences(5, 50)
      const hmm = new GaussianHMM(2, 2, { maxIter: 30, seed: 42 })
      hmm.fit(sequences)

      const bicScore = hmm.bic(sequences)
      expect(typeof bicScore).toBe('number')
      expect(Number.isFinite(bicScore)).toBe(true)
    })

    it('prefers correct number of states (2-state data)', () => {
      const sequences = generateSyntheticSequences(10, 80, 42)

      // Fit with 2 states (correct)
      const hmm2 = new GaussianHMM(2, 2, { maxIter: 50, seed: 42 })
      hmm2.fit(sequences)
      const bic2 = hmm2.bic(sequences)

      // Fit with 5 states (too many)
      const hmm5 = new GaussianHMM(5, 2, { maxIter: 50, seed: 42 })
      hmm5.fit(sequences)
      const bic5 = hmm5.bic(sequences)

      // BIC for 2 states should be lower (better) than 5 states
      expect(bic2).toBeLessThan(bic5)
    })

    it('throws if model is not fitted', () => {
      const hmm = new GaussianHMM(2, 2)
      expect(() => hmm.bic([[[1, 2]]])).toThrow()
    })
  })

  describe('serialization', () => {
    it('toJSON produces a valid JSON-serializable object', () => {
      const sequences = generateSyntheticSequences(3, 30)
      const hmm = new GaussianHMM(2, 2, { maxIter: 10, seed: 42 })
      hmm.fit(sequences)

      const json = hmm.toJSON()
      expect(json.nStates).toBe(2)
      expect(json.nFeatures).toBe(2)
      expect(json.means).toBeDefined()
      expect(json.variances).toBeDefined()
      expect(json.transitionMatrix).toBeDefined()
      expect(json.initialProbs).toBeDefined()

      // Should be JSON-serializable (no typed arrays etc)
      const str = JSON.stringify(json)
      expect(typeof str).toBe('string')
      JSON.parse(str) // should not throw
    })

    it('fromJSON restores a model that produces same predictions', () => {
      const sequences = generateSyntheticSequences(5, 50)
      const hmm = new GaussianHMM(2, 2, { maxIter: 30, seed: 42 })
      hmm.fit(sequences)

      const json = hmm.toJSON()
      const restored = GaussianHMM.fromJSON(json)

      const testSeq = sequences[0]
      const states1 = hmm.predict(testSeq)
      const states2 = restored.predict(testSeq)

      expect(states1).toEqual(states2)
    })

    it('fromJSON restores a model that produces same BIC', () => {
      const sequences = generateSyntheticSequences(5, 50)
      const hmm = new GaussianHMM(2, 2, { maxIter: 30, seed: 42 })
      hmm.fit(sequences)

      const json = hmm.toJSON()
      const restored = GaussianHMM.fromJSON(json)

      const bic1 = hmm.bic(sequences)
      const bic2 = restored.bic(sequences)

      expect(bic1).toBeCloseTo(bic2, 10)
    })
  })

  describe('convergence', () => {
    it('returns converged=true when tolerance is met', () => {
      const sequences = generateSyntheticSequences(5, 50)
      const hmm = new GaussianHMM(2, 2, { maxIter: 100, tol: 1, seed: 42 })
      const result = hmm.fit(sequences)
      // With a very loose tolerance, should converge quickly
      expect(result.converged).toBe(true)
      expect(result.iterations).toBeLessThan(100)
    })

    it('returns converged=false when maxIter is hit first', () => {
      const sequences = generateSyntheticSequences(5, 50)
      const hmm = new GaussianHMM(2, 2, { maxIter: 1, tol: 1e-30, seed: 42 })
      const result = hmm.fit(sequences)
      expect(result.converged).toBe(false)
      expect(result.iterations).toBe(1)
    })
  })

  describe('serialization errors', () => {
    it('toJSON throws if model is not fitted', () => {
      const hmm = new GaussianHMM(2, 2)
      expect(() => hmm.toJSON()).toThrow()
    })
  })

  describe('k-means++ initialization', () => {
    it('spreads centroids to different clusters', () => {
      // Two well-separated clusters: near [0,0] and near [100,100]
      const sequences: number[][][] = []
      // Cluster A: 50 points near [0,0]
      const clusterA: number[][] = []
      for (let i = 0; i < 50; i++) {
        clusterA.push([Math.sin(i) * 0.5, Math.cos(i) * 0.5])
      }
      // Cluster B: 50 points near [100,100]
      const clusterB: number[][] = []
      for (let i = 0; i < 50; i++) {
        clusterB.push([100 + Math.sin(i) * 0.5, 100 + Math.cos(i) * 0.5])
      }
      sequences.push([...clusterA, ...clusterB])

      const hmm = new GaussianHMM(2, 2, { maxIter: 30, seed: 42 })
      hmm.fit(sequences)

      const json = hmm.toJSON()
      const means = json.means

      // One mean should be near [0,0] and the other near [100,100]
      const nearZero = means.some(m => Math.abs(m[0]) < 10 && Math.abs(m[1]) < 10)
      const nearHundred = means.some(m => Math.abs(m[0] - 100) < 10 && Math.abs(m[1] - 100) < 10)
      expect(nearZero).toBe(true)
      expect(nearHundred).toBe(true)
    })

    it('is deterministic with the same seed', () => {
      const sequences = generateSyntheticSequences(5, 50, 99)

      const hmm1 = new GaussianHMM(2, 2, { maxIter: 20, seed: 77 })
      hmm1.fit(sequences)
      const pred1 = hmm1.predict(sequences[0])

      const hmm2 = new GaussianHMM(2, 2, { maxIter: 20, seed: 77 })
      hmm2.fit(sequences)
      const pred2 = hmm2.predict(sequences[0])

      expect(pred1).toEqual(pred2)
    })

    it('initializes transition matrix with sticky diagonal', () => {
      const sequences = generateSyntheticSequences(3, 30, 42)
      const hmm = new GaussianHMM(2, 2, { maxIter: 3, seed: 42 })
      hmm.fit(sequences)

      const json = hmm.toJSON()
      const trans = json.transitionMatrix

      // After only 3 iterations, the diagonal should still dominate
      // because the sticky prior starts with diag=0.7
      for (let i = 0; i < trans.length; i++) {
        for (let j = 0; j < trans[i].length; j++) {
          if (i === j) {
            // Diagonal should be greater than any off-diagonal in this row
            for (let k = 0; k < trans[i].length; k++) {
              if (k !== i) {
                expect(trans[i][i]).toBeGreaterThan(trans[i][k])
              }
            }
          }
        }
      }
    })
  })

  describe('edge cases', () => {
    it('handles single-state model', () => {
      const sequences = generateSyntheticSequences(3, 30)
      const hmm = new GaussianHMM(1, 2, { maxIter: 10, seed: 42 })
      hmm.fit(sequences)
      const states = hmm.predict(sequences[0])
      // With 1 state, everything should be state 0
      for (const s of states) {
        expect(s).toBe(0)
      }
    })

    it('handles single observation sequences', () => {
      const sequences = [[[1, 2]], [[3, 4]], [[5, 6]]]
      const hmm = new GaussianHMM(2, 2, { maxIter: 10, seed: 42 })
      // Should not throw
      hmm.fit(sequences)
      const states = hmm.predict([[1, 2]])
      expect(states).toHaveLength(1)
    })

    it('handles sequences of different lengths', () => {
      const sequences = [
        [[1, 2], [3, 4]],
        [[5, 6], [7, 8], [9, 10]],
        [[11, 12]],
      ]
      const hmm = new GaussianHMM(2, 2, { maxIter: 10, seed: 42 })
      hmm.fit(sequences)
      const states = hmm.predict(sequences[1])
      expect(states).toHaveLength(3)
    })
  })
})
