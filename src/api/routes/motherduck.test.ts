/**
 * MotherDuck API Route Tests (TDD)
 *
 * POST /api/motherduck/query - Execute SQL query
 * POST /api/motherduck/load - Load parquet from URL
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

// Create a mock evaluateQuery that returns different results based on query
const mockEvaluateQuery = vi.fn().mockImplementation((sql: string) => {
  // Default response for COUNT queries
  if (sql.includes('COUNT(*)')) {
    return Promise.resolve({
      data: { toRows: () => [{ cnt: 100, count: 100 }] },
    })
  }
  // Default response for other queries
  return Promise.resolve({
    data: { toRows: () => [{ count: 100 }] },
  })
})

// Mock the MotherDuck WASM client (not available in Node)
vi.mock('@motherduck/wasm-client', () => ({
  MDConnection: {
    create: vi.fn().mockReturnValue({
      isInitialized: vi.fn().mockResolvedValue(true),
      evaluateQuery: mockEvaluateQuery,
    }),
  },
}))

describe('MotherDuck API Routes', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    // Reset module to clear cached connection
    vi.resetModules()
    // Set up mock token in env
    process.env.MOTHERDUCK_TOKEN = 'test-token'
    // Reset the mock to default behavior
    mockEvaluateQuery.mockImplementation((sql: string) => {
      if (sql.includes('COUNT(*)')) {
        return Promise.resolve({
          data: { toRows: () => [{ cnt: 100, count: 100 }] },
        })
      }
      return Promise.resolve({
        data: { toRows: () => [{ count: 100 }] },
      })
    })
  })

  describe('handleQuery', () => {
    it('executes SQL query and returns results', async () => {
      const { handleQuery } = await import('./motherduck')

      const result = await handleQuery({
        sql: 'SELECT COUNT(*) as count FROM flows',
      })

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data![0]).toHaveProperty('count', 100)
    })

    it('rejects empty SQL query', async () => {
      const { handleQuery } = await import('./motherduck')

      const result = await handleQuery({
        sql: '',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('SQL')
    })

    it('rejects when no token is configured', async () => {
      delete process.env.MOTHERDUCK_TOKEN

      // Need to re-import to pick up env change
      vi.resetModules()
      const { handleQuery } = await import('./motherduck')

      const result = await handleQuery({
        sql: 'SELECT 1',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('token')
    })

    it('handles query execution errors', async () => {
      // Make the mock reject for this test
      mockEvaluateQuery.mockRejectedValueOnce(new Error('Query failed'))

      const { handleQuery } = await import('./motherduck')

      const result = await handleQuery({
        sql: 'SELECT * FROM nonexistent',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Query failed')
    })
  })

  describe('handleLoadFromUrl', () => {
    it('loads parquet from URL and returns row count', async () => {
      const { handleLoadFromUrl } = await import('./motherduck')

      const result = await handleLoadFromUrl({
        url: 'https://example.com/data.parquet',
        tableName: 'flows',
      })

      expect(result.success).toBe(true)
      expect(result.rowCount).toBeDefined()
      expect(typeof result.rowCount).toBe('number')
    })

    it('rejects empty URL', async () => {
      const { handleLoadFromUrl } = await import('./motherduck')

      const result = await handleLoadFromUrl({
        url: '',
        tableName: 'flows',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('URL')
    })

    it('rejects invalid URL format', async () => {
      const { handleLoadFromUrl } = await import('./motherduck')

      const result = await handleLoadFromUrl({
        url: 'not-a-url',
        tableName: 'flows',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('URL')
    })

    it('rejects non-https URLs', async () => {
      const { handleLoadFromUrl } = await import('./motherduck')

      const result = await handleLoadFromUrl({
        url: 'http://example.com/data.parquet',
        tableName: 'flows',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('HTTPS')
    })

    it('uses default table name when not provided', async () => {
      const { handleLoadFromUrl } = await import('./motherduck')

      const result = await handleLoadFromUrl({
        url: 'https://example.com/data.parquet',
      })

      expect(result.success).toBe(true)
    })
  })

  describe('handleGetDashboardData', () => {
    it('returns all dashboard data in one call', async () => {
      const { handleGetDashboardData } = await import('./motherduck')

      const result = await handleGetDashboardData({
        bucketMinutes: 60,
      })

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data).toHaveProperty('timeline')
      expect(result.data).toHaveProperty('attacks')
      expect(result.data).toHaveProperty('topSrcIPs')
      expect(result.data).toHaveProperty('topDstIPs')
      expect(result.data).toHaveProperty('flows')
      expect(result.data).toHaveProperty('totalCount')
    })

    it('applies where clause filter', async () => {
      const { handleGetDashboardData } = await import('./motherduck')

      const result = await handleGetDashboardData({
        bucketMinutes: 60,
        whereClause: "Attack = 'Exploits'",
      })

      expect(result.success).toBe(true)
    })
  })
})
