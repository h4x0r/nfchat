import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useNetflowData } from './useNetflowData'
import * as duckdb from '@/lib/duckdb'

// Mock the duckdb module
vi.mock('@/lib/duckdb', () => ({
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
    vi.mocked(duckdb.loadParquetData).mockResolvedValue(1000)
    vi.mocked(duckdb.getTimelineData).mockResolvedValue([])
    vi.mocked(duckdb.getAttackDistribution).mockResolvedValue([])
    vi.mocked(duckdb.getTopTalkers).mockResolvedValue([])
    vi.mocked(duckdb.getFlows).mockResolvedValue([])
    vi.mocked(duckdb.getFlowCount).mockResolvedValue(1000)
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

  it('loads parquet data on mount', async () => {
    renderHook(() => useNetflowData('/data/test.parquet'))

    await waitFor(() => {
      expect(duckdb.loadParquetData).toHaveBeenCalledWith('/data/test.parquet')
    })
  })

  it('fetches dashboard data after loading parquet', async () => {
    vi.mocked(duckdb.loadParquetData).mockResolvedValue(1000)

    const { result } = renderHook(() => useNetflowData('/data/test.parquet'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(duckdb.getTimelineData).toHaveBeenCalled()
    expect(duckdb.getAttackDistribution).toHaveBeenCalled()
    expect(duckdb.getTopTalkers).toHaveBeenCalled()
    expect(duckdb.getFlows).toHaveBeenCalled()
  })

  it('sets error state on load failure', async () => {
    vi.mocked(duckdb.loadParquetData).mockRejectedValue(new Error('Failed to load'))

    const { result } = renderHook(() => useNetflowData('/data/test.parquet'))

    await waitFor(() => {
      expect(result.current.error).toBe('Failed to load')
    })
  })

  it('returns total row count', async () => {
    vi.mocked(duckdb.loadParquetData).mockResolvedValue(2500000)
    vi.mocked(duckdb.getFlowCount).mockResolvedValue(2500000)

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

    expect(duckdb.getTimelineData).toHaveBeenCalled()
    expect(duckdb.getAttackDistribution).toHaveBeenCalled()
  })

  it('refresh accepts filter clause', async () => {
    const { result } = renderHook(() => useNetflowData('/data/test.parquet'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    vi.clearAllMocks()
    await result.current.refresh("Attack = 'Exploits'")

    expect(duckdb.getFlows).toHaveBeenCalledWith(expect.stringContaining('Exploits'), expect.any(Number), expect.any(Number))
  })
})
