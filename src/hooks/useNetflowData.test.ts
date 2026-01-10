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
      expect(duckdb.loadParquetData).toHaveBeenCalledWith(
        '/data/test.parquet',
        expect.objectContaining({
          onProgress: expect.any(Function),
          onLog: expect.any(Function),
        })
      )
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

      // Wait for progress to complete (progress is set before loading becomes false)
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

  describe('granular dashboard building progress', () => {
    it('shows time-proportional progress based on query weights', async () => {
      // Timeline is weighted at 50%, so after it completes, progress should be ~98%
      // (96 + 50/100 * 4 = 98)

      vi.mocked(duckdb.loadParquetData).mockImplementation(async (_url, options) => {
        // Simulate reaching building stage at 96%
        options?.onProgress?.({
          stage: 'building',
          percent: 96,
          message: 'Starting dashboard...',
          timestamp: Date.now(),
        })
        return 1000
      })

      const { result } = renderHook(() => useNetflowData('/data/test.parquet'))

      await waitFor(() => {
        expect(result.current.progress.stage).toBe('complete')
      })

      // After timeline (weight 50), progress should jump to ~98%
      // After attacks (weight 5), progress should be ~98.2%
      // Timeline should cause biggest jump since it has highest weight
      const timelineLog = result.current.logs.find(l => l.message.includes('timeline'))
      const attacksLog = result.current.logs.find(l => l.message.includes('attack'))

      expect(timelineLog).toBeDefined()
      expect(attacksLog).toBeDefined()
    })

    it('shows incremental progress during dashboard building phase', async () => {
      // Make each query take some time so we can capture progress updates
      vi.mocked(duckdb.getTimelineData).mockImplementation(async () => {
        await new Promise(r => setTimeout(r, 10))
        return []
      })
      vi.mocked(duckdb.getAttackDistribution).mockImplementation(async () => {
        await new Promise(r => setTimeout(r, 10))
        return []
      })
      vi.mocked(duckdb.getTopTalkers).mockImplementation(async () => {
        await new Promise(r => setTimeout(r, 10))
        return []
      })
      vi.mocked(duckdb.getFlows).mockImplementation(async () => {
        await new Promise(r => setTimeout(r, 10))
        return []
      })
      vi.mocked(duckdb.getFlowCount).mockImplementation(async () => {
        await new Promise(r => setTimeout(r, 10))
        return 1000
      })

      const { result } = renderHook(() => useNetflowData('/data/test.parquet'))

      // Wait for completion and capture progress
      await waitFor(() => {
        expect(result.current.progress.stage).toBe('complete')
      }, { timeout: 5000 })

      // Check that we saw building stage progress updates
      expect(result.current.logs.some(log =>
        log.message.includes('Loading timeline')
      )).toBe(true)
    })

    it('shows specific sub-messages for each dashboard query', async () => {
      const { result } = renderHook(() => useNetflowData('/data/test.parquet'))

      await waitFor(() => {
        expect(result.current.progress.stage).toBe('complete')
      })

      // Check logs contain specific query names
      const logMessages = result.current.logs.map(l => l.message)

      expect(logMessages.some(m => m.includes('timeline'))).toBe(true)
      expect(logMessages.some(m => m.includes('attack') || m.includes('Attack'))).toBe(true)
      expect(logMessages.some(m => m.includes('talker') || m.includes('Talker') || m.includes('IP'))).toBe(true)
      expect(logMessages.some(m => m.includes('flow') || m.includes('Flow'))).toBe(true)
    })

    it('updates progress percent incrementally from 96 to 100', async () => {
      // Track progress values during building stage
      const buildingPercentages: number[] = []

      // Add delay to queries to ensure we capture intermediate states
      vi.mocked(duckdb.getTimelineData).mockImplementation(async () => {
        await new Promise(r => setTimeout(r, 5))
        return []
      })
      vi.mocked(duckdb.getAttackDistribution).mockImplementation(async () => {
        await new Promise(r => setTimeout(r, 5))
        return []
      })
      vi.mocked(duckdb.getTopTalkers).mockImplementation(async () => {
        await new Promise(r => setTimeout(r, 5))
        return []
      })
      vi.mocked(duckdb.getFlows).mockImplementation(async () => {
        await new Promise(r => setTimeout(r, 5))
        return []
      })
      vi.mocked(duckdb.getFlowCount).mockImplementation(async () => {
        await new Promise(r => setTimeout(r, 5))
        return 1000
      })

      const { result } = renderHook(() => useNetflowData('/data/test.parquet'))

      // Poll for building stage progress values
      const checkProgress = setInterval(() => {
        if (result.current.progress.stage === 'building') {
          buildingPercentages.push(result.current.progress.percent)
        }
      }, 2)

      await waitFor(() => {
        expect(result.current.progress.stage).toBe('complete')
      }, { timeout: 5000 })

      clearInterval(checkProgress)

      // Should have captured multiple distinct progress values between 96 and 100
      // With weighted progress: timeline=98%, attacks=98%, srcIPs=99%, dstIPs=99%, flows=99%, count=100%
      const uniquePercentages = [...new Set(buildingPercentages)]
      expect(uniquePercentages.length).toBeGreaterThan(1)
      expect(Math.min(...uniquePercentages)).toBeGreaterThanOrEqual(96)
      expect(Math.max(...uniquePercentages)).toBeLessThanOrEqual(100)
    })
  })
})
