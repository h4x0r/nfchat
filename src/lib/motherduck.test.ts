import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock the @motherduck/wasm-client module
vi.mock('@motherduck/wasm-client', () => ({
  MDConnection: {
    create: vi.fn(),
  },
}))

// Mock motherduck-auth
vi.mock('./motherduck-auth', () => ({
  getMotherDuckToken: vi.fn(),
  hasMotherDuckToken: vi.fn(),
}))

describe('motherduck', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset module state between tests
    vi.resetModules()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('initMotherDuck', () => {
    it('throws error when no token configured', async () => {
      const { getMotherDuckToken } = await import('./motherduck-auth')
      vi.mocked(getMotherDuckToken).mockReturnValue(null)

      const { initMotherDuck } = await import('./motherduck')
      await expect(initMotherDuck()).rejects.toThrow('MotherDuck token not configured')
    })

    it('creates MDConnection with token', async () => {
      const { getMotherDuckToken } = await import('./motherduck-auth')
      vi.mocked(getMotherDuckToken).mockReturnValue('test-token-123')

      const { MDConnection } = await import('@motherduck/wasm-client')
      const mockConnection = {
        isInitialized: vi.fn().mockResolvedValue(undefined),
        evaluateQuery: vi.fn(),
      }
      vi.mocked(MDConnection.create).mockReturnValue(mockConnection as unknown as ReturnType<typeof MDConnection.create>)

      const { initMotherDuck } = await import('./motherduck')
      const connection = await initMotherDuck()

      expect(MDConnection.create).toHaveBeenCalledWith({ mdToken: 'test-token-123' })
      expect(mockConnection.isInitialized).toHaveBeenCalled()
      expect(connection).toBe(mockConnection)
    })

    it('returns existing connection if already initialized', async () => {
      const { getMotherDuckToken } = await import('./motherduck-auth')
      vi.mocked(getMotherDuckToken).mockReturnValue('test-token-123')

      const { MDConnection } = await import('@motherduck/wasm-client')
      const mockConnection = {
        isInitialized: vi.fn().mockResolvedValue(undefined),
        evaluateQuery: vi.fn(),
      }
      vi.mocked(MDConnection.create).mockReturnValue(mockConnection as unknown as ReturnType<typeof MDConnection.create>)

      const { initMotherDuck } = await import('./motherduck')

      const conn1 = await initMotherDuck()
      const conn2 = await initMotherDuck()

      expect(conn1).toBe(conn2)
      expect(MDConnection.create).toHaveBeenCalledTimes(1) // Only created once
    })
  })

  describe('executeQuery', () => {
    it('executes SQL and returns rows', async () => {
      const { getMotherDuckToken } = await import('./motherduck-auth')
      vi.mocked(getMotherDuckToken).mockReturnValue('test-token-123')

      const mockRows = [
        { id: 1, name: 'test1' },
        { id: 2, name: 'test2' },
      ]

      const { MDConnection } = await import('@motherduck/wasm-client')
      const mockConnection = {
        isInitialized: vi.fn().mockResolvedValue(undefined),
        evaluateQuery: vi.fn().mockResolvedValue({
          data: {
            toRows: () => mockRows,
          },
        }),
      }
      vi.mocked(MDConnection.create).mockReturnValue(mockConnection as unknown as ReturnType<typeof MDConnection.create>)

      const { executeQuery } = await import('./motherduck')
      const result = await executeQuery('SELECT * FROM test')

      expect(mockConnection.evaluateQuery).toHaveBeenCalledWith('SELECT * FROM test')
      expect(result).toEqual(mockRows)
    })

    it('converts BigInt values to Numbers', async () => {
      const { getMotherDuckToken } = await import('./motherduck-auth')
      vi.mocked(getMotherDuckToken).mockReturnValue('test-token-123')

      const mockRows = [
        { count: BigInt(12345), name: 'test' },
      ]

      const { MDConnection } = await import('@motherduck/wasm-client')
      const mockConnection = {
        isInitialized: vi.fn().mockResolvedValue(undefined),
        evaluateQuery: vi.fn().mockResolvedValue({
          data: {
            toRows: () => mockRows,
          },
        }),
      }
      vi.mocked(MDConnection.create).mockReturnValue(mockConnection as unknown as ReturnType<typeof MDConnection.create>)

      const { executeQuery } = await import('./motherduck')
      const result = await executeQuery('SELECT COUNT(*) FROM test')

      expect(result[0].count).toBe(12345)
      expect(typeof result[0].count).toBe('number')
    })

    it('handles query errors', async () => {
      const { getMotherDuckToken } = await import('./motherduck-auth')
      vi.mocked(getMotherDuckToken).mockReturnValue('test-token-123')

      const { MDConnection } = await import('@motherduck/wasm-client')
      const mockConnection = {
        isInitialized: vi.fn().mockResolvedValue(undefined),
        evaluateQuery: vi.fn().mockRejectedValue(new Error('SQL syntax error')),
      }
      vi.mocked(MDConnection.create).mockReturnValue(mockConnection as unknown as ReturnType<typeof MDConnection.create>)

      const { executeQuery } = await import('./motherduck')

      await expect(executeQuery('INVALID SQL')).rejects.toThrow('SQL syntax error')
    })
  })

  describe('getAttackDistribution', () => {
    it('returns attack counts grouped by type', async () => {
      const { getMotherDuckToken } = await import('./motherduck-auth')
      vi.mocked(getMotherDuckToken).mockReturnValue('test-token-123')

      const mockRows = [
        { attack: 'Exploits', count: 100 },
        { attack: 'DoS', count: 50 },
      ]

      const { MDConnection } = await import('@motherduck/wasm-client')
      const mockConnection = {
        isInitialized: vi.fn().mockResolvedValue(undefined),
        evaluateQuery: vi.fn().mockResolvedValue({
          data: { toRows: () => mockRows },
        }),
      }
      vi.mocked(MDConnection.create).mockReturnValue(mockConnection as unknown as ReturnType<typeof MDConnection.create>)

      const { getAttackDistribution } = await import('./motherduck')
      const result = await getAttackDistribution()

      expect(result).toEqual(mockRows)
      expect(mockConnection.evaluateQuery).toHaveBeenCalledWith(
        expect.stringContaining('GROUP BY Attack')
      )
    })
  })

  describe('getTopTalkers', () => {
    it('returns top source IPs by flows', async () => {
      const { getMotherDuckToken } = await import('./motherduck-auth')
      vi.mocked(getMotherDuckToken).mockReturnValue('test-token-123')

      const mockRows = [
        { ip: '192.168.1.1', value: 1000 },
        { ip: '192.168.1.2', value: 500 },
      ]

      const { MDConnection } = await import('@motherduck/wasm-client')
      const mockConnection = {
        isInitialized: vi.fn().mockResolvedValue(undefined),
        evaluateQuery: vi.fn().mockResolvedValue({
          data: { toRows: () => mockRows },
        }),
      }
      vi.mocked(MDConnection.create).mockReturnValue(mockConnection as unknown as ReturnType<typeof MDConnection.create>)

      const { getTopTalkers } = await import('./motherduck')
      const result = await getTopTalkers('src', 'flows', 10)

      expect(result).toEqual(mockRows)
      expect(mockConnection.evaluateQuery).toHaveBeenCalledWith(
        expect.stringContaining('IPV4_SRC_ADDR')
      )
    })

    it('returns top destination IPs by bytes', async () => {
      const { getMotherDuckToken } = await import('./motherduck-auth')
      vi.mocked(getMotherDuckToken).mockReturnValue('test-token-123')

      const mockRows = [{ ip: '10.0.0.1', value: 50000 }]

      const { MDConnection } = await import('@motherduck/wasm-client')
      const mockConnection = {
        isInitialized: vi.fn().mockResolvedValue(undefined),
        evaluateQuery: vi.fn().mockResolvedValue({
          data: { toRows: () => mockRows },
        }),
      }
      vi.mocked(MDConnection.create).mockReturnValue(mockConnection as unknown as ReturnType<typeof MDConnection.create>)

      const { getTopTalkers } = await import('./motherduck')
      const result = await getTopTalkers('dst', 'bytes', 5, "Attack = 'Exploits'")

      expect(result).toEqual(mockRows)
      expect(mockConnection.evaluateQuery).toHaveBeenCalledWith(
        expect.stringContaining('IPV4_DST_ADDR')
      )
      expect(mockConnection.evaluateQuery).toHaveBeenCalledWith(
        expect.stringContaining('SUM(IN_BYTES + OUT_BYTES)')
      )
    })
  })

  describe('getTimelineData', () => {
    it('returns time-bucketed data with attack breakdown', async () => {
      const { getMotherDuckToken } = await import('./motherduck-auth')
      vi.mocked(getMotherDuckToken).mockReturnValue('test-token-123')

      const mockRows = [
        { time: 1700000000000, attack: 'Benign', count: 500 },
        { time: 1700000000000, attack: 'Exploits', count: 50 },
      ]

      const { MDConnection } = await import('@motherduck/wasm-client')
      const mockConnection = {
        isInitialized: vi.fn().mockResolvedValue(undefined),
        evaluateQuery: vi.fn().mockResolvedValue({
          data: { toRows: () => mockRows },
        }),
      }
      vi.mocked(MDConnection.create).mockReturnValue(mockConnection as unknown as ReturnType<typeof MDConnection.create>)

      const { getTimelineData } = await import('./motherduck')
      const result = await getTimelineData(60)

      expect(result).toEqual(mockRows)
      expect(mockConnection.evaluateQuery).toHaveBeenCalledWith(
        expect.stringContaining('GROUP BY time, attack')
      )
    })
  })

  describe('getFlows', () => {
    it('returns flow records with pagination', async () => {
      const { getMotherDuckToken } = await import('./motherduck-auth')
      vi.mocked(getMotherDuckToken).mockReturnValue('test-token-123')

      const mockRows = [
        { FLOW_START_MILLISECONDS: 1700000000000, IPV4_SRC_ADDR: '192.168.1.1' },
      ]

      const { MDConnection } = await import('@motherduck/wasm-client')
      const mockConnection = {
        isInitialized: vi.fn().mockResolvedValue(undefined),
        evaluateQuery: vi.fn().mockResolvedValue({
          data: { toRows: () => mockRows },
        }),
      }
      vi.mocked(MDConnection.create).mockReturnValue(mockConnection as unknown as ReturnType<typeof MDConnection.create>)

      const { getFlows } = await import('./motherduck')
      const result = await getFlows('1=1', 100, 0)

      expect(result).toEqual(mockRows)
      expect(mockConnection.evaluateQuery).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT 100')
      )
      expect(mockConnection.evaluateQuery).toHaveBeenCalledWith(
        expect.stringContaining('OFFSET 0')
      )
    })
  })

  describe('getFlowCount', () => {
    it('returns total flow count', async () => {
      const { getMotherDuckToken } = await import('./motherduck-auth')
      vi.mocked(getMotherDuckToken).mockReturnValue('test-token-123')

      const { MDConnection } = await import('@motherduck/wasm-client')
      const mockConnection = {
        isInitialized: vi.fn().mockResolvedValue(undefined),
        evaluateQuery: vi.fn().mockResolvedValue({
          data: { toRows: () => [{ cnt: 12345 }] },
        }),
      }
      vi.mocked(MDConnection.create).mockReturnValue(mockConnection as unknown as ReturnType<typeof MDConnection.create>)

      const { getFlowCount } = await import('./motherduck')
      const result = await getFlowCount()

      expect(result).toBe(12345)
    })

    it('supports WHERE clause filtering', async () => {
      const { getMotherDuckToken } = await import('./motherduck-auth')
      vi.mocked(getMotherDuckToken).mockReturnValue('test-token-123')

      const { MDConnection } = await import('@motherduck/wasm-client')
      const mockConnection = {
        isInitialized: vi.fn().mockResolvedValue(undefined),
        evaluateQuery: vi.fn().mockResolvedValue({
          data: { toRows: () => [{ cnt: 500 }] },
        }),
      }
      vi.mocked(MDConnection.create).mockReturnValue(mockConnection as unknown as ReturnType<typeof MDConnection.create>)

      const { getFlowCount } = await import('./motherduck')
      const result = await getFlowCount("Attack = 'Exploits'")

      expect(result).toBe(500)
      expect(mockConnection.evaluateQuery).toHaveBeenCalledWith(
        expect.stringContaining("Attack = 'Exploits'")
      )
    })
  })
})
