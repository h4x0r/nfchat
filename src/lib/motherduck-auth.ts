/**
 * MotherDuck Authentication Module
 *
 * Handles token storage and validation for MotherDuck connection.
 * Tokens are stored in localStorage (client-side) with fallback to
 * environment variables for server-side/build usage.
 */

export const MOTHERDUCK_TOKEN_STORAGE_KEY = 'motherduck_token'

/**
 * Get the MotherDuck token from localStorage or environment variable.
 * localStorage takes precedence in browser, env is fallback.
 */
export function getMotherDuckToken(): string | null {
  // Try localStorage first (client-side storage)
  if (typeof localStorage !== 'undefined') {
    const storedToken = localStorage.getItem(MOTHERDUCK_TOKEN_STORAGE_KEY)
    if (storedToken) {
      return storedToken
    }
  }

  // Fallback to environment variable (for build/server usage)
  const envToken = import.meta.env.VITE_MOTHERDUCK_TOKEN
  if (envToken) {
    return envToken
  }

  return null
}

/**
 * Store a MotherDuck token in localStorage.
 */
export function setMotherDuckToken(token: string): void {
  localStorage.setItem(MOTHERDUCK_TOKEN_STORAGE_KEY, token)
}

/**
 * Remove the MotherDuck token from localStorage.
 */
export function clearMotherDuckToken(): void {
  localStorage.removeItem(MOTHERDUCK_TOKEN_STORAGE_KEY)
}

/**
 * Validate a MotherDuck token format.
 * MotherDuck tokens are JWTs (3 base64-encoded parts separated by dots).
 */
export function validateMotherDuckToken(token: string): boolean {
  if (!token || typeof token !== 'string') {
    return false
  }

  // JWT format: header.payload.signature
  const parts = token.split('.')
  if (parts.length !== 3) {
    return false
  }

  // Validate header is valid base64-encoded JSON
  try {
    const header = parts[0]
    // Base64 URL-safe decoding
    const decoded = atob(header.replace(/-/g, '+').replace(/_/g, '/'))
    const parsed = JSON.parse(decoded)

    // Check for typical JWT header fields
    if (!parsed.alg || !parsed.typ) {
      return false
    }

    return true
  } catch {
    return false
  }
}

/**
 * Check if a MotherDuck token is configured.
 */
export function hasMotherDuckToken(): boolean {
  return getMotherDuckToken() !== null
}
