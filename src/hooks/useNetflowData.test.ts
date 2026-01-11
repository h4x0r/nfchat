import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useNetflowData } from './useNetflowData'
import * as motherduck from '@/lib/motherduck'

// Mock the motherduck module
vi.mock('@/lib/motherduck', () => ({
  loadParquetData: vi.fn(),
  getTimelineData: vi.fn(),
  getAttackDistribution: vi.fn(),
  getTopTalkers: vi.fn(),
  getFlows: vi.fn(),
  getFlowCount: vi.fn(),
}))

describe('useNetflowData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Setup default mock returns
    vi.mocked(motherduck.loadParquetData).mockResolvedValue(1000)
    vi.mocked(motherduck.getTimelineData).mockResolvedValue([])
    vi.mocked(motherduck.getAttackDistribution).mockResolvedValue([])
    vi.mocked(motherduck.getTopTalkers).mockResolvedValue([])
    vi.mocked(motherduck.getFlows).mockResolvedValue([])
    vi.mocked(motherduck.getFlowCount).mockResolvedValue(1000)
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

  it('loads data via MotherDuck on mount', async () => {
    renderHook(() => useNetflowData('/data/test.parquet'))

    await waitFor(() => {
      expect(motherduck.loadParquetData).toHaveBeenCalledWith(
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

    expect(motherduck.getTimelineData).toHaveBeenCalled()
    expect(motherduck.getAttackDistribution).toHaveBeenCalled()
    expect(motherduck.getTopTalkers).toHaveBeenCalled()
    expect(motherduck.getFlows).toHaveBeenCalled()
    expect(motherduck.getFlowCount).toHaveBeenCalled()
  })

  it('sets error state on load failure', async () => {
    vi.mocked(motherduck.loadParquetData).mockRejectedValue(new Error('Failed to load'))

    const { result } = renderHook(() => useNetflowData('/data/test.parquet'))

    await waitFor(() => {
      expect(result.current.error).toBe('Failed to load')
    })
  })

  it('returns total row count', async () => {
    vi.mocked(motherduck.loadParquetData).mockResolvedValue(2500000)

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
    vi.mocked(motherduck.getTimelineData).mockResolvedValue([])
    vi.mocked(motherduck.getAttackDistribution).mockResolvedValue([])
    vi.mocked(motherduck.getTopTalkers).mockResolvedValue([])
    vi.mocked(motherduck.getFlows).mockResolvedValue([])
    vi.mocked(motherduck.getFlowCount).mockResolvedValue(1000)

    await result.current.refresh()

    expect(motherduck.getTimelineData).toHaveBeenCalled()
  })

  it('refresh accepts filter clause', async () => {
    const { result } = renderHook(() => useNetflowData('/data/test.parquet'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    vi.clearAllMocks()
    // Re-setup mocks after clear
    vi.mocked(motherduck.getTimelineData).mockResolvedValue([])
    vi.mocked(motherduck.getAttackDistribution).mockResolvedValue([])
    vi.mocked(motherduck.getTopTalkers).mockResolvedValue([])
    vi.mocked(motherduck.getFlows).mockResolvedValue([])
    vi.mocked(motherduck.getFlowCount).mockResolvedValue(1000)

    await result.current.refresh("Attack = 'Exploits'")

    expect(motherduck.getTimelineData).toHaveBeenCalledWith(60, "Attack = 'Exploits'")
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
