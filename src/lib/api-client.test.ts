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

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/motherduck/load',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ url: 'https://example.com/data.parquet' }),
        })
      )
      expect(result.success).toBe(true)
      expect(result.rowCount).toBe(1000)
    })

    it('throws ApiError on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ success: false, error: 'Failed to load' }),
      })

      const { loadDataFromUrl, ApiError } = await import('./api-client')

      await expect(loadDataFromUrl('https://example.com/data.parquet')).rejects.toThrow(ApiError)
    })

    it('throws error with message from response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ success: false, error: 'Custom error message' }),
      })

      const { loadDataFromUrl } = await import('./api-client')

      await expect(loadDataFromUrl('https://example.com/data.parquet')).rejects.toThrow(
        'Custom error message'
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

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/motherduck/dashboard',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ bucketMinutes: 60, whereClause: '1=1' }),
        })
      )
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

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/motherduck/dashboard',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ bucketMinutes: 30, whereClause: "Attack = 'Exploits'" }),
        })
      )
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

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/motherduck/query',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ sql: 'SELECT COUNT(*) FROM flows' }),
        })
      )
      expect(result).toEqual([{ count: 100 }])
    })
  })

  describe('ApiError', () => {
    it('exposes structured error info', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ success: false, error: 'Server error' }),
      })

      const { loadDataFromUrl, isApiError } = await import('./api-client')

      try {
        await loadDataFromUrl('https://example.com/data.parquet')
        expect.fail('Should have thrown')
      } catch (err) {
        expect(isApiError(err)).toBe(true)
        if (isApiError(err)) {
          expect(err.appError).toBeDefined()
          expect(err.appError.message).toBe('Server error')
          expect(err.appError.correlationId).toBeDefined()
        }
      }
    })

    it('isRetryable returns true for network errors', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))

      const { loadDataFromUrl, isApiError } = await import('./api-client')

      try {
        await loadDataFromUrl('https://example.com/data.parquet')
        expect.fail('Should have thrown')
      } catch (err) {
        expect(isApiError(err)).toBe(true)
        if (isApiError(err)) {
          expect(err.isRetryable).toBe(true)
        }
      }
    })
  })

  describe('Request tracing', () => {
    it('includes X-Request-ID header in requests', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: [{ count: 1 }] }),
      })

      const { executeQuery } = await import('./api-client')
      await executeQuery('SELECT 1')

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/motherduck/query',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Request-ID': expect.stringMatching(/^[a-z0-9]+-[a-z0-9]+$/),
          }),
        })
      )
    })
  })

  describe('Request deduplication', () => {
    it('deduplicates concurrent identical requests', async () => {
      // Use a Promise that we control to ensure requests are truly concurrent
      let resolveJson: (value: unknown) => void
      const jsonPromise = new Promise((resolve) => {
        resolveJson = resolve
      })

      mockFetch.mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () => jsonPromise,
        })
      )

      const { getFlows } = await import('./api-client')

      // Start two identical requests concurrently
      const request1 = getFlows({ whereClause: '1=1', limit: 50, offset: 0 })
      const request2 = getFlows({ whereClause: '1=1', limit: 50, offset: 0 })

      // Resolve the fetch
      resolveJson!({ success: true, data: { flows: [], totalCount: 0 } })

      // Both should resolve successfully
      const [result1, result2] = await Promise.all([request1, request2])

      // Fetch should only be called once due to deduplication
      expect(mockFetch).toHaveBeenCalledTimes(1)

      // Both results should be identical
      expect(result1).toEqual(result2)
    })

    it('does not deduplicate requests with different parameters', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: { flows: [], totalCount: 0 } }),
      })

      const { getFlows } = await import('./api-client')

      // Start two requests with different parameters
      const request1 = getFlows({ whereClause: '1=1', limit: 50, offset: 0 })
      const request2 = getFlows({ whereClause: '1=1', limit: 50, offset: 50 })

      await Promise.all([request1, request2])

      // Both should trigger separate fetch calls
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('allows new request after previous one completes', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: { flows: [], totalCount: 0 } }),
      })

      const { getFlows } = await import('./api-client')

      // First request
      await getFlows({ whereClause: '1=1', limit: 50, offset: 0 })

      // Second identical request after first completes
      await getFlows({ whereClause: '1=1', limit: 50, offset: 0 })

      // Both should trigger separate fetch calls since first completed
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })
  })
})
