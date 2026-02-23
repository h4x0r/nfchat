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
    it('calls load endpoint with URL (probes first, then loads)', async () => {
      // Probe
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, rowCount: 1000 }),
      })
      // Load
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, rowCount: 1000 }),
      })

      const { loadDataFromUrl } = await import('./api-client')
      const result = await loadDataFromUrl('https://example.com/data.parquet')

      // First call is probe
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/motherduck/load',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ url: 'https://example.com/data.parquet', action: 'probe' }),
        })
      )
      expect(result.success).toBe(true)
      expect(result.rowCount).toBe(1000)
    })

    it('throws ApiError on non-ok probe response', async () => {
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
      // Probe fails with server error
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
      // Network error on probe
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

  describe('loadDataChunked (chunked loading)', () => {
    const SMALL_URL = 'https://example.com/small.parquet'
    const LARGE_URL = 'https://example.com/large.parquet'
    const CHUNK_SIZE = 500_000

    it('probes row count before loading', async () => {
      // Probe returns small count → single load
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, rowCount: 100_000 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, rowCount: 100_000 }),
        })

      const { loadDataFromUrl } = await import('./api-client')
      await loadDataFromUrl(SMALL_URL)

      // First call should be the probe
      const firstCall = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(firstCall).toEqual({ url: SMALL_URL, action: 'probe' })
    })

    it('uses single load for small files (<=500K rows)', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, rowCount: 400_000 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, rowCount: 400_000 }),
        })

      const { loadDataFromUrl } = await import('./api-client')
      const result = await loadDataFromUrl(SMALL_URL)

      // probe + single load = 2 calls
      expect(mockFetch).toHaveBeenCalledTimes(2)

      // Second call should be a regular load (no action or action='load')
      const secondCall = JSON.parse(mockFetch.mock.calls[1][1].body)
      expect(secondCall.url).toBe(SMALL_URL)
      expect(secondCall.action).toBe('load')

      expect(result.rowCount).toBe(400_000)
    })

    it('uses chunked loading for large files (>500K rows)', async () => {
      const totalRows = 1_200_000
      const expectedChunks = Math.ceil(totalRows / CHUNK_SIZE) // 3 chunks

      // probe
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, rowCount: totalRows }),
      })
      // create (first chunk)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, rowCount: CHUNK_SIZE }),
      })
      // append chunk 2
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, rowCount: CHUNK_SIZE }),
      })
      // append chunk 3 (remaining 200K)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, rowCount: 200_000 }),
      })

      const { loadDataFromUrl } = await import('./api-client')
      const result = await loadDataFromUrl(LARGE_URL)

      // probe + create + 2 appends = 4 calls
      expect(mockFetch).toHaveBeenCalledTimes(4)
      expect(result.rowCount).toBe(totalRows)
    })

    it('sends correct offsets for each chunk', async () => {
      const totalRows = 1_200_000

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, rowCount: totalRows }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, rowCount: CHUNK_SIZE }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, rowCount: CHUNK_SIZE }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, rowCount: 200_000 }),
        })

      const { loadDataFromUrl } = await import('./api-client')
      await loadDataFromUrl(LARGE_URL)

      // create: offset 0, chunkSize 500K
      const createCall = JSON.parse(mockFetch.mock.calls[1][1].body)
      expect(createCall).toEqual({
        url: LARGE_URL,
        action: 'create',
        chunkSize: CHUNK_SIZE,
      })

      // append 1: offset 500K
      const append1 = JSON.parse(mockFetch.mock.calls[2][1].body)
      expect(append1).toEqual({
        url: LARGE_URL,
        action: 'append',
        chunkSize: CHUNK_SIZE,
        offset: CHUNK_SIZE,
      })

      // append 2: offset 1M
      const append2 = JSON.parse(mockFetch.mock.calls[3][1].body)
      expect(append2).toEqual({
        url: LARGE_URL,
        action: 'append',
        chunkSize: CHUNK_SIZE,
        offset: CHUNK_SIZE * 2,
      })
    })

    it('calls onProgress with non-decreasing percent per chunk', async () => {
      const totalRows = 1_200_000
      const progressCalls: number[] = []

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, rowCount: totalRows }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, rowCount: CHUNK_SIZE }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, rowCount: CHUNK_SIZE }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, rowCount: 200_000 }),
        })

      const { loadDataFromUrl } = await import('./api-client')
      await loadDataFromUrl(LARGE_URL, {
        onProgress: (event) => {
          progressCalls.push(event.percent)
        },
      })

      // Verify non-decreasing
      for (let i = 1; i < progressCalls.length; i++) {
        expect(progressCalls[i]).toBeGreaterThanOrEqual(progressCalls[i - 1])
      }

      // Should reach 100%
      expect(progressCalls[progressCalls.length - 1]).toBe(100)

      // Should have multiple progress updates (not just 2)
      expect(progressCalls.length).toBeGreaterThanOrEqual(4)
    })

    it('throws ApiError on probe failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ success: false, error: 'MotherDuck connection failed' }),
      })

      const { loadDataFromUrl, ApiError } = await import('./api-client')

      await expect(loadDataFromUrl(LARGE_URL)).rejects.toThrow(ApiError)
      // Should not attempt any load after probe fails
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('throws ApiError on mid-chunk failure', async () => {
      const totalRows = 1_200_000

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, rowCount: totalRows }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, rowCount: CHUNK_SIZE }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({ success: false, error: 'Timeout loading chunk' }),
        })

      const { loadDataFromUrl, ApiError } = await import('./api-client')

      try {
        await loadDataFromUrl(LARGE_URL)
        expect.fail('Should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError)
        expect((err as Error).message).toBe('Timeout loading chunk')
      }
    })
  })

  describe('uploadFile', () => {
    // XHR behavior control per test
    let xhrBehavior: 'succeed' | 'fail' | 'progress-then-succeed'
    let xhrSentFile: File | null
    let xhrOpenUrl: string | null
    let progressEvents: Array<{ loaded: number; total: number }>

    beforeEach(() => {
      xhrBehavior = 'succeed'
      xhrSentFile = null
      xhrOpenUrl = null
      progressEvents = []

      // @ts-expect-error - partial mock using function constructor (arrow functions can't be constructors)
      global.XMLHttpRequest = function MockXHR() {
        const self = this as Record<string, unknown>
        self.open = vi.fn((_method: string, url: string) => { xhrOpenUrl = url })
        self.setRequestHeader = vi.fn()
        self.upload = { onprogress: null }
        self.onload = null
        self.onerror = null
        self.status = 200
        self.send = vi.fn((body: File) => {
          xhrSentFile = body
          Promise.resolve().then(() => {
            if (xhrBehavior === 'progress-then-succeed') {
              for (const e of progressEvents) {
                (self.upload as { onprogress: ((e: { loaded: number; total: number }) => void) | null }).onprogress?.(e)
              }
            }
            if (xhrBehavior === 'fail') {
              (self.onerror as (() => void) | null)?.()
            } else {
              (self.onload as (() => void) | null)?.()
            }
          })
        })
      }
    })

    it('requests presigned URL from /api/upload/presign', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          uploadUrl: 'https://r2.example.com/presigned-put',
          publicUrl: 'https://pub.example.com/tmp/test.parquet',
          key: 'tmp/12345-test.parquet',
        }),
      })

      const { uploadFile } = await import('./api-client')
      const file = new File(['data'], 'test.parquet', { type: 'application/octet-stream' })

      const result = await uploadFile(file)

      // Should have called presign endpoint
      const presignCall = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(presignCall).toEqual({ filename: 'test.parquet' })
      expect(mockFetch.mock.calls[0][0]).toBe('/api/upload/presign')

      expect(result.url).toBe('https://pub.example.com/tmp/test.parquet')
      expect(result.key).toBe('tmp/12345-test.parquet')
    })

    it('uploads file via XHR PUT to presigned URL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          uploadUrl: 'https://r2.example.com/presigned-put',
          publicUrl: 'https://pub.example.com/tmp/test.parquet',
          key: 'tmp/12345-test.parquet',
        }),
      })

      const { uploadFile } = await import('./api-client')
      const file = new File(['data'], 'test.parquet', { type: 'application/octet-stream' })
      await uploadFile(file)

      expect(xhrOpenUrl).toBe('https://r2.example.com/presigned-put')
      expect(xhrSentFile).toBe(file)
    })

    it('rejects unsupported file types', async () => {
      const { uploadFile } = await import('./api-client')
      const file = new File(['data'], 'test.xlsx', { type: 'application/vnd.ms-excel' })

      await expect(uploadFile(file)).rejects.toThrow('Unsupported file type')
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('accepts .csv files', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          uploadUrl: 'https://r2.example.com/presigned-put',
          publicUrl: 'https://pub.example.com/tmp/test.csv',
          key: 'tmp/12345-test.csv',
        }),
      })

      const { uploadFile } = await import('./api-client')
      const file = new File(['a,b\n1,2'], 'test.csv', { type: 'text/csv' })
      const result = await uploadFile(file)

      expect(result.url).toBe('https://pub.example.com/tmp/test.csv')
    })

    it('throws ApiError on presign failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ success: false, error: 'R2 credentials not configured' }),
      })

      const { uploadFile, ApiError } = await import('./api-client')
      const file = new File(['data'], 'test.parquet', { type: 'application/octet-stream' })

      await expect(uploadFile(file)).rejects.toThrow(ApiError)
    })

    it('throws on XHR upload failure', async () => {
      xhrBehavior = 'fail'

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          uploadUrl: 'https://r2.example.com/presigned-put',
          publicUrl: 'https://pub.example.com/tmp/test.parquet',
          key: 'tmp/12345-test.parquet',
        }),
      })

      const { uploadFile } = await import('./api-client')
      const file = new File(['data'], 'test.parquet', { type: 'application/octet-stream' })

      await expect(uploadFile(file)).rejects.toThrow('Upload failed')
    })

    it('reports upload progress via onProgress', async () => {
      xhrBehavior = 'progress-then-succeed'
      progressEvents = [
        { loaded: 500, total: 1000 },
        { loaded: 1000, total: 1000 },
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          uploadUrl: 'https://r2.example.com/presigned-put',
          publicUrl: 'https://pub.example.com/tmp/test.parquet',
          key: 'tmp/12345-test.parquet',
        }),
      })

      const progressCalls: number[] = []
      const { uploadFile } = await import('./api-client')
      const file = new File(['data'], 'test.parquet', { type: 'application/octet-stream' })

      await uploadFile(file, {
        onProgress: (event) => progressCalls.push(event.percent),
      })

      // Should have progress events from both presign phase and upload phase
      expect(progressCalls.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('cleanupUpload', () => {
    it('calls /api/upload/cleanup with keys', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      })

      const { cleanupUpload } = await import('./api-client')
      await cleanupUpload(['tmp/12345-test.parquet'])

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/upload/cleanup',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ keys: ['tmp/12345-test.parquet'] }),
        })
      )
    })

    it('handles multiple keys', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      })

      const { cleanupUpload } = await import('./api-client')
      await cleanupUpload(['tmp/csv-file.csv', 'tmp/parquet-file.parquet'])

      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.keys).toEqual(['tmp/csv-file.csv', 'tmp/parquet-file.parquet'])
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
