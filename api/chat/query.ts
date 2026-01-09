/**
 * Vercel API Route: POST /api/chat/query
 *
 * Step 1 of AI-driven data fetching:
 * Accept a question, return SQL queries needed to answer it
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handleQuery } from '../../src/api/routes/query'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  try {
    const { question, turnstileToken } = req.body || {}

    // Get client IP from Vercel headers
    const clientIP =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      '127.0.0.1'

    const result = await handleQuery({
      question: question || '',
      turnstileToken: turnstileToken || '',
      clientIP,
    })

    if (!result.success) {
      return res.status(400).json(result)
    }

    return res.status(200).json(result)
  } catch (error) {
    console.error('Chat query error:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}
