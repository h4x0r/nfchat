/**
 * Chat Analyze Endpoint Tests (TDD - RED phase)
 *
 * POST /api/chat/analyze
 * Accepts data from executed queries, returns AI analysis
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Mock fetch for Turnstile
global.fetch = vi.fn()

describe('POST /api/chat/analyze', () => {
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

  it('returns analysis for valid data', async () => {
    const { handleAnalyze } = await import('./analyze')

    const result = await handleAnalyze({
      question: 'What attacks are most common?',
      data: [
        { attack: 'Exploits', count: 100 },
        { attack: 'DoS', count: 50 },
      ],
      turnstileToken: 'test-token',
      clientIP: '127.0.0.1',
    })

    expect(result.success).toBe(true)
    expect(result.response).toBeDefined()
    expect(result.response!.length).toBeGreaterThan(0)
  })

  it('rejects request without question', async () => {
    const { handleAnalyze } = await import('./analyze')

    const result = await handleAnalyze({
      question: '',
      data: [{ attack: 'Exploits', count: 100 }],
      turnstileToken: 'test-token',
      clientIP: '127.0.0.1',
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('question')
  })

  it('rejects request without data', async () => {
    const { handleAnalyze } = await import('./analyze')

    const result = await handleAnalyze({
      question: 'What attacks?',
      data: undefined as unknown as unknown[],
      turnstileToken: 'test-token',
      clientIP: '127.0.0.1',
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('data')
  })

  it('handles empty data array gracefully', async () => {
    const { handleAnalyze } = await import('./analyze')

    const result = await handleAnalyze({
      question: 'What attacks?',
      data: [],
      turnstileToken: 'test-token',
      clientIP: '127.0.0.1',
    })

    expect(result.success).toBe(true)
    expect(result.response).toContain('0 records')
  })

  it('validates turnstile token when secret is configured', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'test-secret'

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: false, 'error-codes': ['invalid-input-response'] }),
    } as Response)

    const { handleAnalyze } = await import('./analyze')

    const result = await handleAnalyze({
      question: 'What attacks?',
      data: [{ attack: 'Exploits', count: 100 }],
      turnstileToken: 'invalid-token',
      clientIP: '127.0.0.1',
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('verification')
  })
})
