/**
 * Turnstile Verification Tests (TDD - RED phase)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Mock fetch
global.fetch = vi.fn()

describe('Turnstile Verification', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    process.env = { ...originalEnv, TURNSTILE_SECRET_KEY: 'test-secret-key' }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('verifyTurnstileToken', () => {
    it('returns success for valid token', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response)

      const { verifyTurnstileToken } = await import('./turnstile')
      const result = await verifyTurnstileToken('valid-token', '192.168.1.1')

      expect(result.success).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('returns failure for invalid token', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: false, 'error-codes': ['invalid-input-response'] }),
      } as Response)

      const { verifyTurnstileToken } = await import('./turnstile')
      const result = await verifyTurnstileToken('invalid-token', '192.168.1.1')

      expect(result.success).toBe(false)
      expect(result.error).toBe('invalid-input-response')
    })

    it('returns failure on network error', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))

      const { verifyTurnstileToken } = await import('./turnstile')
      const result = await verifyTurnstileToken('any-token', '192.168.1.1')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Network error')
    })

    it('calls Cloudflare API with correct parameters', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response)

      const { verifyTurnstileToken } = await import('./turnstile')
      await verifyTurnstileToken('test-token', '10.0.0.1')

      expect(fetch).toHaveBeenCalledWith(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      )
    })

    it('skips verification when no secret key is set', async () => {
      process.env = { ...process.env, TURNSTILE_SECRET_KEY: '' }
      delete process.env.TURNSTILE_SECRET_KEY

      const { verifyTurnstileToken } = await import('./turnstile')
      const result = await verifyTurnstileToken('any-token', '127.0.0.1')

      expect(result.success).toBe(true)
      expect(fetch).not.toHaveBeenCalled()
    })
  })
})
