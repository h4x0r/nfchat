import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// We'll import these after implementing
// import {
//   getMotherDuckToken,
//   setMotherDuckToken,
//   clearMotherDuckToken,
//   validateMotherDuckToken,
//   MOTHERDUCK_TOKEN_STORAGE_KEY,
// } from './motherduck-auth'

const MOTHERDUCK_TOKEN_STORAGE_KEY = 'motherduck_token'

describe('motherduck-auth', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()
    // Clear env var to isolate tests
    vi.stubEnv('VITE_MOTHERDUCK_TOKEN', '')
  })

  afterEach(() => {
    localStorage.clear()
    vi.unstubAllEnvs()
  })

  describe('getMotherDuckToken', () => {
    it('returns null when no token is stored', async () => {
      const { getMotherDuckToken } = await import('./motherduck-auth')
      expect(getMotherDuckToken()).toBeNull()
    })

    it('returns token from localStorage when stored', async () => {
      const testToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test'
      localStorage.setItem(MOTHERDUCK_TOKEN_STORAGE_KEY, testToken)

      const { getMotherDuckToken } = await import('./motherduck-auth')
      expect(getMotherDuckToken()).toBe(testToken)
    })

    it('returns token from environment variable if not in localStorage', async () => {
      // Environment variable takes precedence for server-side/build usage
      vi.stubEnv('VITE_MOTHERDUCK_TOKEN', 'env-token-123')

      const { getMotherDuckToken } = await import('./motherduck-auth')
      // Note: In browser, localStorage takes precedence, env is fallback
      // This test checks env fallback when localStorage is empty
      expect(getMotherDuckToken()).toBe('env-token-123')

      vi.unstubAllEnvs()
    })
  })

  describe('setMotherDuckToken', () => {
    it('stores token in localStorage', async () => {
      const { setMotherDuckToken } = await import('./motherduck-auth')
      const testToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test'

      setMotherDuckToken(testToken)

      expect(localStorage.getItem(MOTHERDUCK_TOKEN_STORAGE_KEY)).toBe(testToken)
    })

    it('overwrites existing token', async () => {
      const { setMotherDuckToken, getMotherDuckToken } = await import('./motherduck-auth')
      setMotherDuckToken('old-token')
      setMotherDuckToken('new-token')

      expect(getMotherDuckToken()).toBe('new-token')
    })
  })

  describe('clearMotherDuckToken', () => {
    it('removes token from localStorage', async () => {
      localStorage.setItem(MOTHERDUCK_TOKEN_STORAGE_KEY, 'some-token')

      const { clearMotherDuckToken } = await import('./motherduck-auth')
      clearMotherDuckToken()

      expect(localStorage.getItem(MOTHERDUCK_TOKEN_STORAGE_KEY)).toBeNull()
    })

    it('does not throw when no token exists', async () => {
      const { clearMotherDuckToken } = await import('./motherduck-auth')
      expect(() => clearMotherDuckToken()).not.toThrow()
    })
  })

  describe('validateMotherDuckToken', () => {
    it('returns true for valid JWT-like token', async () => {
      const { validateMotherDuckToken } = await import('./motherduck-auth')
      // Valid MotherDuck token format (JWT with 3 parts)
      const validToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20ifQ.signature'

      expect(validateMotherDuckToken(validToken)).toBe(true)
    })

    it('returns false for empty string', async () => {
      const { validateMotherDuckToken } = await import('./motherduck-auth')
      expect(validateMotherDuckToken('')).toBe(false)
    })

    it('returns false for non-JWT format', async () => {
      const { validateMotherDuckToken } = await import('./motherduck-auth')
      expect(validateMotherDuckToken('not-a-jwt')).toBe(false)
      expect(validateMotherDuckToken('only.two.parts')).toBe(false)
    })

    it('returns false for token without valid header', async () => {
      const { validateMotherDuckToken } = await import('./motherduck-auth')
      // Token must have valid base64-encoded JSON header
      expect(validateMotherDuckToken('invalid.payload.signature')).toBe(false)
    })
  })

  describe('hasMotherDuckToken', () => {
    it('returns true when token exists', async () => {
      localStorage.setItem(MOTHERDUCK_TOKEN_STORAGE_KEY, 'some-token')

      const { hasMotherDuckToken } = await import('./motherduck-auth')
      expect(hasMotherDuckToken()).toBe(true)
    })

    it('returns false when no token', async () => {
      const { hasMotherDuckToken } = await import('./motherduck-auth')
      expect(hasMotherDuckToken()).toBe(false)
    })
  })
})
