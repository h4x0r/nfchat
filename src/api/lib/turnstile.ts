/**
 * Cloudflare Turnstile Verification
 *
 * Verifies that requests come from real users, not bots.
 * https://developers.cloudflare.com/turnstile/
 */

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

export interface TurnstileResult {
  success: boolean
  error?: string
}

interface TurnstileResponse {
  success: boolean
  'error-codes'?: string[]
  challenge_ts?: string
  hostname?: string
}

/**
 * Verify a Turnstile token with Cloudflare's API
 *
 * @param token - The token from the client-side Turnstile widget
 * @param remoteip - The user's IP address
 * @returns Verification result
 */
export async function verifyTurnstileToken(
  token: string,
  remoteip: string
): Promise<TurnstileResult> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY

  // In development without secret key, allow bypass
  if (!secretKey) {
    console.warn('[Turnstile] No TURNSTILE_SECRET_KEY set, skipping verification')
    return { success: true }
  }

  // Dev bypass token for testing
  if (token === 'dev-bypass' && process.env.NODE_ENV === 'development') {
    return { success: true }
  }

  try {
    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        secret: secretKey,
        response: token,
        remoteip,
      }),
    })

    const data: TurnstileResponse = await response.json()

    if (data.success) {
      return { success: true }
    }

    return {
      success: false,
      error: data['error-codes']?.[0] || 'verification-failed',
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}
