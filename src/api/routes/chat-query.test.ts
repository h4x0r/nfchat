/**
 * Chat Query Endpoint Tests (TDD - RED phase)
 *
 * POST /api/chat/query
 * Accepts a question, returns SQL queries needed to answer it
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Mock fetch for Turnstile
global.fetch = vi.fn()

describe('POST /api/chat/query', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    process.env = { ...originalEnv }
    // Disable Turnstile and API key for unit tests (use fallback behavior)
    delete process.env.TURNSTILE_SECRET_KEY
    delete process.env.ANTHROPIC_API_KEY
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('returns SQL queries for valid question', async () => {
    const { handleQuery } = await import('./query')

    const result = await handleQuery({
      question: 'What attacks are most common?',
      turnstileToken: 'test-token',
      clientIP: '127.0.0.1',
    })

    expect(result.success).toBe(true)
    expect(result.queries).toBeDefined()
    expect(result.queries!.length).toBeGreaterThan(0)
  })

  it('rejects request without question', async () => {
    const { handleQuery } = await import('./query')

    const result = await handleQuery({
      question: '',
      turnstileToken: 'test-token',
      clientIP: '127.0.0.1',
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('question')
  })

  it('rejects request without turnstile token', async () => {
    const { handleQuery } = await import('./query')

    const result = await handleQuery({
      question: 'What attacks?',
      turnstileToken: '',
      clientIP: '127.0.0.1',
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('token')
  })

  it('validates turnstile token when secret is configured', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'test-secret'

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: false, 'error-codes': ['invalid-input-response'] }),
    } as Response)

    const { handleQuery } = await import('./query')

    const result = await handleQuery({
      question: 'What attacks?',
      turnstileToken: 'invalid-token',
      clientIP: '127.0.0.1',
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('verification')
  })

  it('returns empty queries for greetings', async () => {
    const { handleQuery } = await import('./query')

    const result = await handleQuery({
      question: 'Hello!',
      turnstileToken: 'test-token',
      clientIP: '127.0.0.1',
    })

    expect(result.success).toBe(true)
    expect(result.queries).toEqual([])
  })
})
