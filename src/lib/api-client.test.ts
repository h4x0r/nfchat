/**
 * API Client Tests (TDD)
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('API Client', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetModules()
  })

  describe('loadDataFromUrl', () => {
    it('calls load endpoint with URL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, rowCount: 1000 }),
      })

      const { loadDataFromUrl } = await import('./api-client')
      const result = await loadDataFromUrl('https://example.com/data.parquet')

      expect(mockFetch).toHaveBeenCalledWith('/api/motherduck/load', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://example.com/data.parquet' }),
      })
      expect(result.success).toBe(true)
      expect(result.rowCount).toBe(1000)
    })

    it('throws on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ success: false, error: 'Failed to load' }),
      })

      const { loadDataFromUrl } = await import('./api-client')

      await expect(loadDataFromUrl('https://example.com/data.parquet')).rejects.toThrow(
        'Failed to load'
      )
    })
  })

  describe('getDashboardData', () => {
    it('calls dashboard endpoint and returns data', async () => {
      const mockData = {
        timeline: [],
        attacks: [],
        topSrcIPs: [],
        topDstIPs: [],
        flows: [],
        totalCount: 1000,
      }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockData }),
      })

      const { getDashboardData } = await import('./api-client')
      const result = await getDashboardData()

      expect(mockFetch).toHaveBeenCalledWith('/api/motherduck/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bucketMinutes: 60, whereClause: '1=1' }),
      })
      expect(result).toEqual(mockData)
    })

    it('passes filter parameters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { timeline: [], attacks: [], topSrcIPs: [], topDstIPs: [], flows: [], totalCount: 0 },
        }),
      })

      const { getDashboardData } = await import('./api-client')
      await getDashboardData({ bucketMinutes: 30, whereClause: "Attack = 'Exploits'" })

      expect(mockFetch).toHaveBeenCalledWith('/api/motherduck/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bucketMinutes: 30, whereClause: "Attack = 'Exploits'" }),
      })
    })
  })

  describe('executeQuery', () => {
    it('executes SQL query via API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: [{ count: 100 }] }),
      })

      const { executeQuery } = await import('./api-client')
      const result = await executeQuery('SELECT COUNT(*) FROM flows')

      expect(mockFetch).toHaveBeenCalledWith('/api/motherduck/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: 'SELECT COUNT(*) FROM flows' }),
      })
      expect(result).toEqual([{ count: 100 }])
    })
  })
})
