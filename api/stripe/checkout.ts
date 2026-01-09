/**
 * Vercel API Route: POST /api/stripe/checkout
 *
 * Creates a Stripe Checkout session for credit purchase
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createCheckoutSession, type PackType, CREDIT_PACKS } from '../../src/api/lib/stripe'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Get user ID from session cookie
    const cookies = req.headers.cookie || ''
    const userId = cookies.match(/user_id=([^;]+)/)?.[1]

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    const { packType } = req.body || {}

    if (!packType || !CREDIT_PACKS[packType as PackType]) {
      return res.status(400).json({
        error: 'Invalid pack type',
        validTypes: Object.keys(CREDIT_PACKS),
      })
    }

    const session = await createCheckoutSession(userId, packType as PackType)

    return res.status(200).json({
      success: true,
      sessionId: session.sessionId,
      url: session.url,
    })
  } catch (error) {
    console.error('Stripe checkout error:', error)
    return res.status(500).json({ error: 'Failed to create checkout session' })
  }
}
