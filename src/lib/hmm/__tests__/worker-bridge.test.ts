import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { trainInWorker } from '../worker-bridge'

// Captured mock worker instance
let capturedWorker: MockWorkerInstance | null = null

class MockWorkerInstance {
  onmessage: ((e: MessageEvent) => void) | null = null
  onerror: ((e: ErrorEvent) => void) | null = null
  postMessage = vi.fn()
  terminate = vi.fn()

  constructor() {
    capturedWorker = this
  }
}

describe('trainInWorker', () => {
  let originalWorker: typeof globalThis.Worker

  beforeEach(() => {
    originalWorker = globalThis.Worker
    capturedWorker = null
  })

  afterEach(() => {
    globalThis.Worker = originalWorker
    vi.restoreAllMocks()
  })

  it('sends train message with matrix and requestedStates', async () => {
    // @ts-expect-error - mock Worker class
    globalThis.Worker = MockWorkerInstance

    const matrix = [[1, 2], [3, 4]]
    const promise = trainInWorker(matrix, 5)

    const worker = capturedWorker!
    expect(worker.postMessage).toHaveBeenCalledWith({
      type: 'train',
      matrix,
      requestedStates: 5,
    })

    worker.onmessage!({
      data: {
        type: 'result',
        states: [0, 1],
        nStates: 2,
        converged: true,
        iterations: 10,
        logLikelihood: -100,
      },
    } as MessageEvent)

    const result = await promise
    expect(result).toEqual({
      states: [0, 1],
      nStates: 2,
      converged: true,
      iterations: 10,
      logLikelihood: -100,
    })
  })

  it('terminates worker after result', async () => {
    // @ts-expect-error - mock Worker class
    globalThis.Worker = MockWorkerInstance

    const promise = trainInWorker([[1]], 2)
    const worker = capturedWorker!

    worker.onmessage!({
      data: {
        type: 'result',
        states: [0],
        nStates: 1,
        converged: true,
        iterations: 5,
        logLikelihood: -50,
      },
    } as MessageEvent)

    await promise
    expect(worker.terminate).toHaveBeenCalled()
  })

  it('calls onProgress for progress messages', async () => {
    // @ts-expect-error - mock Worker class
    globalThis.Worker = MockWorkerInstance

    const onProgress = vi.fn()
    const promise = trainInWorker([[1, 2]], 3, onProgress)
    const worker = capturedWorker!

    // Send progress messages
    worker.onmessage!({
      data: { type: 'progress', percent: 20, phase: 'scaling' },
    } as MessageEvent)

    worker.onmessage!({
      data: { type: 'progress', percent: 60, phase: 'training' },
    } as MessageEvent)

    expect(onProgress).toHaveBeenCalledTimes(2)
    expect(onProgress).toHaveBeenCalledWith(20, 'scaling')
    expect(onProgress).toHaveBeenCalledWith(60, 'training')

    // Send result to resolve
    worker.onmessage!({
      data: {
        type: 'result',
        states: [0],
        nStates: 1,
        converged: true,
        iterations: 5,
        logLikelihood: -50,
      },
    } as MessageEvent)

    await promise
  })

  it('rejects on worker error message', async () => {
    // @ts-expect-error - mock Worker class
    globalThis.Worker = MockWorkerInstance

    const promise = trainInWorker([[1]], 2)
    const worker = capturedWorker!

    worker.onmessage!({
      data: { type: 'error', message: 'Training diverged' },
    } as MessageEvent)

    await expect(promise).rejects.toThrow('Training diverged')
    expect(worker.terminate).toHaveBeenCalled()
  })

  it('rejects on worker onerror', async () => {
    // @ts-expect-error - mock Worker class
    globalThis.Worker = MockWorkerInstance

    const promise = trainInWorker([[1]], 2)
    const worker = capturedWorker!

    worker.onerror!({
      message: 'Script error',
    } as ErrorEvent)

    await expect(promise).rejects.toThrow('Script error')
    expect(worker.terminate).toHaveBeenCalled()
  })

  it('falls back to synchronous execution when Worker is undefined', async () => {
    // @ts-expect-error - simulate no Worker
    globalThis.Worker = undefined

    // Create simple 2-cluster data
    const matrix: number[][] = []
    for (let i = 0; i < 30; i++) {
      matrix.push([i < 15 ? 0 : 5, i < 15 ? 0 : 5])
    }

    const result = await trainInWorker(matrix, 2)
    expect(result.nStates).toBe(2)
    expect(result.states).toHaveLength(30)
    expect(typeof result.converged).toBe('boolean')
    expect(typeof result.iterations).toBe('number')
    expect(typeof result.logLikelihood).toBe('number')
  })

  it('falls back to synchronous with auto state selection (requestedStates=0)', async () => {
    // @ts-expect-error - simulate no Worker
    globalThis.Worker = undefined

    // Create data with a few clear clusters
    const matrix: number[][] = []
    for (let i = 0; i < 60; i++) {
      const cluster = i % 3
      matrix.push([cluster * 10, cluster * 10])
    }

    const result = await trainInWorker(matrix, 0)
    expect(result.nStates).toBeGreaterThanOrEqual(3)
    expect(result.states).toHaveLength(60)
  })

  it('fallback calls onProgress', async () => {
    // @ts-expect-error - simulate no Worker
    globalThis.Worker = undefined

    const onProgress = vi.fn()
    const matrix: number[][] = []
    for (let i = 0; i < 20; i++) {
      matrix.push([i < 10 ? 0 : 5, i < 10 ? 0 : 5])
    }

    await trainInWorker(matrix, 2, onProgress)
    expect(onProgress).toHaveBeenCalled()
  })

  describe('per-destination grouping', () => {
    it('accepts optional groupIds parameter', async () => {
      // @ts-expect-error - simulate no Worker
      globalThis.Worker = undefined

      const matrix: number[][] = []
      const groupIds: string[] = []
      // Group A (10 flows near [0,0]), Group B (10 flows near [10,10])
      for (let i = 0; i < 10; i++) {
        matrix.push([0 + Math.random() * 0.1, 0 + Math.random() * 0.1])
        groupIds.push('10.0.0.1')
      }
      for (let i = 0; i < 10; i++) {
        matrix.push([10 + Math.random() * 0.1, 10 + Math.random() * 0.1])
        groupIds.push('10.0.0.2')
      }

      const result = await trainInWorker(matrix, 2, undefined, groupIds)
      expect(result.states).toHaveLength(20)
      expect(result.nStates).toBe(2)
    })

    it('returns states in original row order when groupIds provided', async () => {
      // @ts-expect-error - simulate no Worker
      globalThis.Worker = undefined

      // Interleave two groups: A,B,A,B,A,B...
      const matrix: number[][] = []
      const groupIds: string[] = []
      for (let i = 0; i < 20; i++) {
        if (i % 2 === 0) {
          matrix.push([0, 0])
          groupIds.push('group-A')
        } else {
          matrix.push([10, 10])
          groupIds.push('group-B')
        }
      }

      const result = await trainInWorker(matrix, 2, undefined, groupIds)
      expect(result.states).toHaveLength(20)

      // Verify states alternate — same-group rows should get same state
      const stateA = result.states[0]
      const stateB = result.states[1]
      expect(stateA).not.toBe(stateB)
      for (let i = 0; i < 20; i++) {
        expect(result.states[i]).toBe(i % 2 === 0 ? stateA : stateB)
      }
    })

    it('works without groupIds (backward compatible)', async () => {
      // @ts-expect-error - simulate no Worker
      globalThis.Worker = undefined

      const matrix: number[][] = []
      for (let i = 0; i < 20; i++) {
        matrix.push([i < 10 ? 0 : 5, i < 10 ? 0 : 5])
      }

      // No groupIds — should work as before
      const result = await trainInWorker(matrix, 2)
      expect(result.states).toHaveLength(20)
    })

    it('passes groupIds to worker via postMessage', async () => {
      // @ts-expect-error - mock Worker class
      globalThis.Worker = MockWorkerInstance

      const matrix = [[1, 2], [3, 4]]
      const groupIds = ['10.0.0.1', '10.0.0.2']
      const promise = trainInWorker(matrix, 2, undefined, groupIds)

      const worker = capturedWorker!
      expect(worker.postMessage).toHaveBeenCalledWith({
        type: 'train',
        matrix,
        requestedStates: 2,
        groupIds,
      })

      worker.onmessage!({
        data: {
          type: 'result',
          states: [0, 1],
          nStates: 2,
          converged: true,
          iterations: 10,
          logLikelihood: -100,
        },
      } as MessageEvent)

      await promise
    })
  })

  describe('BIC optimization', () => {
    it('BIC auto-selects k=2 for 2-cluster data (range starts at k=2)', async () => {
      // @ts-expect-error - simulate no Worker
      globalThis.Worker = undefined

      // Two well-separated clusters: [0,0] and [10,10]
      const matrix: number[][] = []
      for (let i = 0; i < 40; i++) {
        matrix.push([i < 20 ? 0 : 10, i < 20 ? 0 : 10])
      }

      const result = await trainInWorker(matrix, 0)
      // With BIC starting at k=2, it should correctly select k=2
      expect(result.nStates).toBe(2)
    })

    it('BIC auto-selects low k for clearly separated clusters', async () => {
      // @ts-expect-error - simulate no Worker
      globalThis.Worker = undefined

      // Three well-separated clusters
      const matrix: number[][] = []
      for (let i = 0; i < 60; i++) {
        const c = i % 3
        matrix.push([c * 20, c * 20])
      }

      const result = await trainInWorker(matrix, 0)
      expect(result.nStates).toBeGreaterThanOrEqual(2)
      expect(result.nStates).toBeLessThanOrEqual(4)
    })

    it('returns valid result with relaxed convergence params', async () => {
      // @ts-expect-error - simulate no Worker
      globalThis.Worker = undefined

      const matrix: number[][] = []
      for (let i = 0; i < 30; i++) {
        matrix.push([i < 15 ? 0 : 5, i < 15 ? 0 : 5])
      }

      const result = await trainInWorker(matrix, 3)
      expect(result.nStates).toBe(3)
      expect(result.states).toHaveLength(30)
      expect(typeof result.converged).toBe('boolean')
    })

    it('BIC completes for medium-size matrix', async () => {
      // @ts-expect-error - simulate no Worker
      globalThis.Worker = undefined

      // 500 rows with 2 clusters — should complete in reasonable time
      const matrix: number[][] = []
      for (let i = 0; i < 500; i++) {
        matrix.push([i < 250 ? 0 : 10, i < 250 ? 0 : 10])
      }

      const result = await trainInWorker(matrix, 0)
      expect(result.nStates).toBeGreaterThanOrEqual(2)
      expect(result.states).toHaveLength(500)
    })

    it('BIC early stop prevents unnecessary iterations', async () => {
      // @ts-expect-error - simulate no Worker
      globalThis.Worker = undefined

      // Track progress calls to verify early stopping
      const progressCalls: Array<{ percent: number; phase: string }> = []
      const onProgress = (percent: number, phase: string) => {
        progressCalls.push({ percent, phase })
      }

      // Clear 2-cluster data — BIC should increase quickly after k=2
      const matrix: number[][] = []
      for (let i = 0; i < 40; i++) {
        matrix.push([i < 20 ? 0 : 10, i < 20 ? 0 : 10])
      }

      const result = await trainInWorker(matrix, 0, onProgress)
      expect(result.nStates).toBe(2)

      // With early stop, BIC phase should have fewer progress calls
      // than the full k=2..10 range (9 iterations)
      const bicCalls = progressCalls.filter(p => p.phase === 'bic-selection')
      // At minimum: initial 25% + one call per k tested
      // With early stop after 2 consecutive increases: k=2(best), k=3(worse), k=4(worse) → stop
      // So we expect at most ~5 bic-selection calls (initial + 3 k values + possible extras)
      expect(bicCalls.length).toBeLessThan(10)
    })
  })
})
