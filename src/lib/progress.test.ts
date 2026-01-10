import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createProgressTracker,
  fetchWithProgress,
  formatBytes,
  type ProgressEvent,
  type LogEntry,
} from './progress'

describe('progress', () => {
  describe('createProgressTracker', () => {
    it('emits progress events with correct structure', () => {
      const onProgress = vi.fn()
      const tracker = createProgressTracker(onProgress)

      tracker.emit('downloading', 50, 'Downloading file...')

      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          stage: 'downloading',
          percent: 50,
          message: 'Downloading file...',
          timestamp: expect.any(Number),
        })
      )
    })

    it('emits log entries with elapsed time', () => {
      const onProgress = vi.fn()
      const onLog = vi.fn()
      const tracker = createProgressTracker(onProgress, onLog)

      tracker.log('info', 'Starting download')

      expect(onLog).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'info',
          message: expect.stringMatching(/^\[\d+\.\d+s\] Starting download$/),
          timestamp: expect.any(Number),
        })
      )
    })

    it('includes extra properties in progress events', () => {
      const onProgress = vi.fn()
      const tracker = createProgressTracker(onProgress)

      tracker.emit('downloading', 25, 'Downloading...', {
        bytesLoaded: 25000000,
        bytesTotal: 100000000,
      })

      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          bytesLoaded: 25000000,
          bytesTotal: 100000000,
        })
      )
    })
  })

  describe('fetchWithProgress', () => {
    beforeEach(() => {
      vi.restoreAllMocks()
    })

    it('reports download progress via callback', async () => {
      const progressUpdates: Array<{ loaded: number; total: number }> = []

      // Mock fetch with streaming response
      const mockData = new Uint8Array(1000).fill(42)
      const mockStream = new ReadableStream({
        start(controller) {
          // Send in chunks
          controller.enqueue(mockData.slice(0, 500))
          controller.enqueue(mockData.slice(500))
          controller.close()
        },
      })

      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-length': '1000' }),
        body: mockStream,
      } as Response)

      await fetchWithProgress('https://example.com/file', (loaded, total) => {
        progressUpdates.push({ loaded, total })
      })

      expect(progressUpdates.length).toBeGreaterThan(0)
      expect(progressUpdates[progressUpdates.length - 1].loaded).toBe(1000)
      expect(progressUpdates[0].total).toBe(1000)
    })

    it('throws on HTTP error', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as Response)

      await expect(
        fetchWithProgress('https://example.com/file', vi.fn())
      ).rejects.toThrow('HTTP 404: Not Found')
    })

    it('throttles progress callbacks to avoid excessive updates', async () => {
      const progressUpdates: Array<{ loaded: number; total: number }> = []

      // Mock fetch with many small chunks (simulating real network)
      const chunkSize = 1000
      const totalChunks = 100 // 100 chunks = 100KB
      const mockData = new Uint8Array(chunkSize * totalChunks).fill(42)

      const mockStream = new ReadableStream({
        start(controller) {
          // Send 100 small chunks rapidly
          for (let i = 0; i < totalChunks; i++) {
            controller.enqueue(mockData.slice(i * chunkSize, (i + 1) * chunkSize))
          }
          controller.close()
        },
      })

      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-length': String(chunkSize * totalChunks) }),
        body: mockStream,
      } as Response)

      await fetchWithProgress('https://example.com/file', (loaded, total) => {
        progressUpdates.push({ loaded, total })
      })

      // Should have far fewer updates than chunks due to throttling
      // At minimum we get first and last, typically around 10-20 max
      expect(progressUpdates.length).toBeLessThan(totalChunks)
      // But we should still get the final update with full data
      expect(progressUpdates[progressUpdates.length - 1].loaded).toBe(chunkSize * totalChunks)
    })
  })

  describe('formatBytes', () => {
    it('formats bytes correctly', () => {
      expect(formatBytes(500)).toBe('500 B')
      expect(formatBytes(1024)).toBe('1.0 KB')
      expect(formatBytes(1536)).toBe('1.5 KB')
      expect(formatBytes(1024 * 1024)).toBe('1.0 MB')
      expect(formatBytes(104857600)).toBe('100.0 MB')
    })
  })

  describe('combineChunks (memory optimization)', () => {
    it('combines chunks into single ArrayBuffer', async () => {
      const { combineChunks } = await import('./progress')
      const chunk1 = new Uint8Array([1, 2, 3])
      const chunk2 = new Uint8Array([4, 5, 6])
      const chunks = [chunk1, chunk2]

      const result = combineChunks(chunks, 6)

      expect(new Uint8Array(result)).toEqual(new Uint8Array([1, 2, 3, 4, 5, 6]))
    })

    it('clears input chunks array to allow garbage collection', async () => {
      const { combineChunks } = await import('./progress')
      const chunk1 = new Uint8Array([1, 2, 3])
      const chunk2 = new Uint8Array([4, 5, 6])
      const chunks = [chunk1, chunk2]

      combineChunks(chunks, 6)

      // Critical: chunks array should be cleared to release references
      expect(chunks.length).toBe(0)
    })

    it('handles empty chunks array', async () => {
      const { combineChunks } = await import('./progress')
      const chunks: Uint8Array[] = []

      const result = combineChunks(chunks, 0)

      expect(result.byteLength).toBe(0)
    })
  })
})
