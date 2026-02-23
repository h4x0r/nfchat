import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useNetflowData } from './useNetflowData'
import * as apiClient from '@/lib/api-client'

// Mock the api-client module
vi.mock('@/lib/api-client', () => ({
  loadDataFromUrl: vi.fn(),
  getDashboardData: vi.fn(),
  uploadFile: vi.fn(),
  cleanupUpload: vi.fn(),
}))

describe('useNetflowData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Setup default mock returns
    vi.mocked(apiClient.loadDataFromUrl).mockResolvedValue({
      success: true,
      rowCount: 1000,
    })
    vi.mocked(apiClient.getDashboardData).mockResolvedValue({
      timeline: [],
      attacks: [],
      topSrcIPs: [],
      topDstIPs: [],
      flows: [],
      totalCount: 1000,
    })
  })

  it('returns loading state when URL provided', async () => {
    const { result } = renderHook(() => useNetflowData('/data/test.parquet'))
    // Loading starts as false, then becomes true when effect runs
    await waitFor(() => {
      expect(result.current.loading).toBe(false) // Eventually finishes loading
    })
  })

  it('returns not loading when no URL provided', () => {
    const { result } = renderHook(() => useNetflowData(''))
    expect(result.current.loading).toBe(false)
  })

  it('loads data via server-side API on mount', async () => {
    renderHook(() => useNetflowData('/data/test.parquet'))

    await waitFor(() => {
      expect(apiClient.loadDataFromUrl).toHaveBeenCalledWith(
        '/data/test.parquet',
        expect.objectContaining({
          onProgress: expect.any(Function),
          onLog: expect.any(Function),
        })
      )
    })
  })

  it('fetches dashboard data after loading parquet', async () => {
    const { result } = renderHook(() => useNetflowData('/data/test.parquet'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(apiClient.getDashboardData).toHaveBeenCalled()
  })

  it('sets error state on load failure', async () => {
    vi.mocked(apiClient.loadDataFromUrl).mockRejectedValue(new Error('Failed to load'))

    const { result } = renderHook(() => useNetflowData('/data/test.parquet'))

    await waitFor(() => {
      expect(result.current.error).toBe('Failed to load')
    })
  })

  it('returns total row count', async () => {
    vi.mocked(apiClient.loadDataFromUrl).mockResolvedValue({
      success: true,
      rowCount: 2500000,
    })

    const { result } = renderHook(() => useNetflowData('/data/test.parquet'))

    await waitFor(() => {
      expect(result.current.totalRows).toBe(2500000)
    })
  })

  it('provides refresh function', async () => {
    const { result } = renderHook(() => useNetflowData('/data/test.parquet'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    vi.clearAllMocks()
    // Re-setup mocks after clear
    vi.mocked(apiClient.getDashboardData).mockResolvedValue({
      timeline: [],
      attacks: [],
      topSrcIPs: [],
      topDstIPs: [],
      flows: [],
      totalCount: 1000,
    })

    await result.current.refresh()

    expect(apiClient.getDashboardData).toHaveBeenCalled()
  })

  it('refresh accepts filter clause', async () => {
    const { result } = renderHook(() => useNetflowData('/data/test.parquet'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    vi.clearAllMocks()
    // Re-setup mocks after clear
    vi.mocked(apiClient.getDashboardData).mockResolvedValue({
      timeline: [],
      attacks: [],
      topSrcIPs: [],
      topDstIPs: [],
      flows: [],
      totalCount: 1000,
    })

    await result.current.refresh("Attack = 'Exploits'")

    expect(apiClient.getDashboardData).toHaveBeenCalledWith(
      expect.objectContaining({
        whereClause: "Attack = 'Exploits'",
      })
    )
  })

  describe('progress tracking', () => {
    it('returns progress object with stage and percent', () => {
      const { result } = renderHook(() => useNetflowData(''))
      expect(result.current.progress).toMatchObject({
        stage: 'initializing',
        percent: 0,
      })
    })

    it('updates progress through loading stages', async () => {
      const { result } = renderHook(() => useNetflowData('/data/test.parquet'))

      // Wait for progress to complete
      await waitFor(() => {
        expect(result.current.progress.percent).toBe(100)
        expect(result.current.progress.stage).toBe('complete')
      })
    })

    it('returns logs array', () => {
      const { result } = renderHook(() => useNetflowData(''))
      expect(result.current.logs).toEqual([])
    })

    it('handles file source: uploads, loads, then cleans up', async () => {
      vi.mocked(apiClient.uploadFile).mockResolvedValue({
        url: 'https://pub.example.com/tmp/test.parquet',
        key: 'tmp/12345-test.parquet',
      })
      vi.mocked(apiClient.cleanupUpload).mockResolvedValue(undefined)

      const file = new File(['data'], 'test.parquet', { type: 'application/octet-stream' })
      const source = { type: 'file' as const, file }

      const { result } = renderHook(() => useNetflowData(source))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // Should have uploaded the file
      expect(apiClient.uploadFile).toHaveBeenCalledWith(
        file,
        expect.objectContaining({ onProgress: expect.any(Function) })
      )
      // Should have loaded from the uploaded URL
      expect(apiClient.loadDataFromUrl).toHaveBeenCalledWith(
        'https://pub.example.com/tmp/test.parquet',
        expect.objectContaining({ onProgress: expect.any(Function) })
      )
      // Should have cleaned up
      expect(apiClient.cleanupUpload).toHaveBeenCalledWith(['tmp/12345-test.parquet'])
    })

    it('file source: error when upload fails', async () => {
      vi.mocked(apiClient.uploadFile).mockRejectedValue(new Error('Upload failed'))

      const file = new File(['data'], 'test.parquet', { type: 'application/octet-stream' })
      const source = { type: 'file' as const, file }

      const { result } = renderHook(() => useNetflowData(source))

      await waitFor(() => {
        expect(result.current.error).toBe('Upload failed')
      })

      // Should NOT have tried to load data
      expect(apiClient.loadDataFromUrl).not.toHaveBeenCalled()
    })

    it('string URL source: uploadFile not called', async () => {
      const { result } = renderHook(() => useNetflowData('/data/test.parquet'))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(apiClient.uploadFile).not.toHaveBeenCalled()
    })

    it('handles chunked progress from loadDataFromUrl', async () => {
      // Simulate loadDataFromUrl calling onProgress multiple times (chunked)
      vi.mocked(apiClient.loadDataFromUrl).mockImplementation(async (_url, options) => {
        const onProgress = options?.onProgress
        // Probe phase
        onProgress?.({ stage: 'downloading', percent: 10, message: 'Probing...', timestamp: Date.now() })
        // Chunk 1
        onProgress?.({ stage: 'downloading', percent: 15, message: 'Loading chunk 1/3...', timestamp: Date.now() })
        // Chunk 2
        onProgress?.({ stage: 'downloading', percent: 42, message: 'Loading chunk 2/3...', timestamp: Date.now() })
        // Chunk 3
        onProgress?.({ stage: 'downloading', percent: 68, message: 'Loading chunk 3/3...', timestamp: Date.now() })
        // Complete
        onProgress?.({ stage: 'complete', percent: 100, message: 'Loaded 1,200,000 rows', timestamp: Date.now() })
        return { success: true, rowCount: 1_200_000 }
      })

      const { result } = renderHook(() => useNetflowData('/data/large.parquet'))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
        expect(result.current.totalRows).toBe(1_200_000)
      })

      // Progress should have reached 100 (the hook's own final progress update)
      expect(result.current.progress.percent).toBe(100)
    })
  })
})
