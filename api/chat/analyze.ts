/**
 * Vercel API Route: POST /api/chat/analyze
 *
 * Step 2 of AI-driven data fetching:
 * Accept query results, return AI analysis
 *
 * Note: Code is inlined because Vercel doesn't properly trace
 * imports from shared modules in the api/ directory.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'

// ============================================================================
// Inlined from src/api/lib/turnstile.ts
// ============================================================================

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

interface TurnstileResult {
  success: boolean
  error?: string
}

interface TurnstileResponse {
  success: boolean
  'error-codes'?: string[]
}

async function verifyTurnstileToken(
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

// ============================================================================
// Inlined from src/api/lib/chat.ts (fallback mode only)
// ============================================================================

interface AnalyzeResult {
  response: string
}

async function analyzeWithData(
  _question: string,
  data: unknown[]
): Promise<AnalyzeResult> {
  // AI Gateway temporarily disabled - return placeholder
  return {
    response: `Based on the data provided, I can see ${data.length} records. AI analysis is temporarily unavailable.`,
  }
}

// ============================================================================
// Handler
// ============================================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  try {
    const { question, data, turnstileToken } = req.body || {}

    // Validate required fields
    if (!question || (typeof question === 'string' && question.trim().length === 0)) {
      return res.status(400).json({ success: false, error: 'Missing question' })
    }

    if (!data || !Array.isArray(data)) {
      return res.status(400).json({ success: false, error: 'Missing or invalid data' })
    }

    if (!turnstileToken || (typeof turnstileToken === 'string' && turnstileToken.trim().length === 0)) {
      return res.status(400).json({ success: false, error: 'Missing turnstile token' })
    }

    // Get client IP from Vercel headers
    const clientIP =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      '127.0.0.1'

    // Verify Turnstile token
    const turnstileResult = await verifyTurnstileToken(turnstileToken, clientIP)
    if (!turnstileResult.success) {
      return res.status(400).json({
        success: false,
        error: `Turnstile verification failed: ${turnstileResult.error}`,
      })
    }

    // Get AI analysis (fallback mode)
    const result = await analyzeWithData(question, data)

    return res.status(200).json({
      success: true,
      response: result.response,
    })
  } catch (error) {
    console.error('Chat analyze error:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}
