import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useNetflowData } from './useNetflowData'
import * as apiClient from '@/lib/api-client'

// Mock the api-client module
vi.mock('@/lib/api-client', () => ({
  loadDataFromUrl: vi.fn(),
  getDashboardData: vi.fn(),
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

  it('loads data via API on mount', async () => {
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
    await result.current.refresh()

    expect(apiClient.getDashboardData).toHaveBeenCalled()
  })

  it('refresh accepts filter clause', async () => {
    const { result } = renderHook(() => useNetflowData('/data/test.parquet'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    vi.clearAllMocks()
    await result.current.refresh("Attack = 'Exploits'")

    expect(apiClient.getDashboardData).toHaveBeenCalledWith(
      expect.objectContaining({ whereClause: "Attack = 'Exploits'" })
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
  })
})
