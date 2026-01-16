/**
 * Vercel API Route: POST /api/chat/query
 *
 * Step 1 of AI-driven data fetching:
 * Accept a question, return SQL queries needed to answer it
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

interface DetermineQueriesResult {
  queries: string[]
  reasoning?: string
}

function generateFallbackQueries(question: string): DetermineQueriesResult {
  const lowerQuestion = question.toLowerCase()
  const queries: string[] = []

  if (lowerQuestion.includes('attack') || lowerQuestion.includes('threat')) {
    queries.push("SELECT Attack, COUNT(*) as count FROM flows GROUP BY Attack ORDER BY count DESC LIMIT 20")
  }

  if (lowerQuestion.includes('ip') || lowerQuestion.includes('source') || lowerQuestion.includes('address')) {
    queries.push("SELECT IPV4_SRC_ADDR as ip, COUNT(*) as count FROM flows GROUP BY IPV4_SRC_ADDR ORDER BY count DESC LIMIT 20")
  }

  if (lowerQuestion.includes('port') || lowerQuestion.includes('scan')) {
    queries.push("SELECT IPV4_SRC_ADDR, COUNT(DISTINCT L4_DST_PORT) as ports FROM flows GROUP BY IPV4_SRC_ADDR HAVING ports > 10 ORDER BY ports DESC LIMIT 20")
  }

  if (lowerQuestion.includes('traffic') || lowerQuestion.includes('bytes') || lowerQuestion.includes('volume')) {
    queries.push("SELECT IPV4_SRC_ADDR, SUM(IN_BYTES + OUT_BYTES) as total_bytes FROM flows GROUP BY IPV4_SRC_ADDR ORDER BY total_bytes DESC LIMIT 20")
  }

  // Default query if nothing matches
  if (queries.length === 0) {
    queries.push("SELECT Attack, COUNT(*) as count FROM flows GROUP BY Attack ORDER BY count DESC LIMIT 20")
  }

  return { queries }
}

async function determineNeededQueries(question: string): Promise<DetermineQueriesResult> {
  // For simple greetings or non-data questions, return empty
  const lowerQuestion = question.toLowerCase()
  if (
    lowerQuestion.match(/^(hi|hello|hey|thanks|thank you|bye|goodbye)/i) ||
    lowerQuestion.length < 10
  ) {
    return { queries: [] }
  }

  // Use keyword-based fallback (AI Gateway temporarily disabled)
  return generateFallbackQueries(question)
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
    const { question, turnstileToken } = req.body || {}

    // Validate required fields
    if (!question || (typeof question === 'string' && question.trim().length === 0)) {
      return res.status(400).json({ success: false, error: 'Missing question' })
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

    // Get queries from fallback mode
    const result = await determineNeededQueries(question)

    return res.status(200).json({
      success: true,
      queries: result.queries,
      reasoning: result.reasoning,
    })
  } catch (error) {
    console.error('Chat query error:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}
