/**
 * Chat API Tests
 *
 * Tests the AI-driven data fetching flow:
 * 1. Client sends question → AI determines needed queries
 * 2. Client sends data → AI responds with analysis
 *
 * Uses Vercel AI Gateway. Tests run in fallback mode (no AI_GATEWAY_API_KEY).
 * Integration tests with real API should be separate.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// No mocks needed - AI Gateway is temporarily disabled
// The chat module uses keyword-based fallback only

describe('Chat API', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    // Tests run without AI Gateway auth = fallback behavior
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('determineNeededQueries (fallback mode)', () => {
    it('returns SQL queries for attack-related questions', async () => {
      const { determineNeededQueries } = await import('./chat')
      const result = await determineNeededQueries('What attacks are most common?')

      expect(result.queries).toBeDefined()
      expect(result.queries.length).toBeGreaterThan(0)
      expect(result.queries[0]).toContain('SELECT')
      expect(result.queries[0]).toContain('Attack')
    })

    it('returns SQL queries for IP-related questions', async () => {
      const { determineNeededQueries } = await import('./chat')
      const result = await determineNeededQueries('Which IPs are sending the most traffic?')

      expect(result.queries.length).toBeGreaterThan(0)
      expect(result.queries[0]).toContain('IPV4_SRC_ADDR')
    })

    it('returns SQL queries for port scan questions', async () => {
      const { determineNeededQueries } = await import('./chat')
      const result = await determineNeededQueries('Which IPs are doing port scans?')

      expect(result.queries.length).toBeGreaterThan(0)
      // May match multiple keywords, so check that port query is included
      const hasPortQuery = result.queries.some((q) => q.includes('L4_DST_PORT'))
      expect(hasPortQuery).toBe(true)
    })

    it('returns empty queries for general questions', async () => {
      const { determineNeededQueries } = await import('./chat')
      const result = await determineNeededQueries('Hello!')

      expect(result.queries.length).toBe(0)
    })

    it('returns default query when no keywords match', async () => {
      const { determineNeededQueries } = await import('./chat')
      const result = await determineNeededQueries('Tell me something interesting about the network')

      expect(result.queries.length).toBeGreaterThan(0)
    })
  })

  describe('analyzeWithData (fallback mode)', () => {
    it('returns placeholder analysis without API key', async () => {
      const { analyzeWithData } = await import('./chat')
      const result = await analyzeWithData(
        'What attacks are most common?',
        [{ attack: 'Exploits', count: 100 }, { attack: 'DoS', count: 50 }]
      )

      expect(result.response).toBeDefined()
      expect(result.response.length).toBeGreaterThan(0)
      expect(result.response).toContain('2 records')
    })

    it('handles empty data gracefully', async () => {
      const { analyzeWithData } = await import('./chat')
      const result = await analyzeWithData(
        'What attacks are in the data?',
        []
      )

      expect(result.response).toBeDefined()
      expect(result.response).toContain('0 records')
    })
  })

  describe('validateSQL', () => {
    it('allows SELECT statements', async () => {
      const { validateSQL } = await import('./chat')
      expect(validateSQL('SELECT * FROM flows')).toBe(true)
    })

    it('rejects DROP statements', async () => {
      const { validateSQL } = await import('./chat')
      expect(validateSQL('DROP TABLE flows')).toBe(false)
    })

    it('rejects DELETE statements', async () => {
      const { validateSQL } = await import('./chat')
      expect(validateSQL('DELETE FROM flows')).toBe(false)
    })

    it('rejects INSERT statements', async () => {
      const { validateSQL } = await import('./chat')
      expect(validateSQL('INSERT INTO flows VALUES (1)')).toBe(false)
    })

    it('rejects UPDATE statements', async () => {
      const { validateSQL } = await import('./chat')
      expect(validateSQL('UPDATE flows SET x = 1')).toBe(false)
    })

    it('adds LIMIT if missing', async () => {
      const { sanitizeSQL } = await import('./chat')
      const result = sanitizeSQL('SELECT * FROM flows')
      expect(result).toContain('LIMIT')
    })

    it('preserves existing LIMIT', async () => {
      const { sanitizeSQL } = await import('./chat')
      const result = sanitizeSQL('SELECT * FROM flows LIMIT 100')
      expect(result).toBe('SELECT * FROM flows LIMIT 100')
    })
  })

  describe('buildSystemPrompt', () => {
    it('includes netflow schema information', async () => {
      const { buildSystemPrompt } = await import('./chat')
      const prompt = buildSystemPrompt()

      expect(prompt).toContain('IPV4_SRC_ADDR')
      expect(prompt).toContain('Attack')
      expect(prompt).toContain('FLOW_START_MILLISECONDS')
    })
  })
})
