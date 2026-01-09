/**
 * Vercel API Route: POST /api/chat/analyze
 *
 * Step 2 of AI-driven data fetching:
 * Accept query results, return AI analysis
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handleAnalyze } from '../../src/api/routes/analyze'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  try {
    const { question, data, turnstileToken } = req.body || {}

    // Get client IP from Vercel headers
    const clientIP =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      '127.0.0.1'

    const result = await handleAnalyze({
      question: question || '',
      data: data,
      turnstileToken: turnstileToken || '',
      clientIP,
    })

    if (!result.success) {
      return res.status(400).json(result)
    }

    return res.status(200).json(result)
  } catch (error) {
    console.error('Chat analyze error:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}
