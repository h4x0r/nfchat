/**
 * Vercel API Route: POST /api/stripe/webhook
 *
 * Handles Stripe webhook events for payment processing
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handleWebhook } from '../../src/api/lib/stripe'

// Disable body parsing to get raw body for signature verification
export const config = {
  api: {
    bodyParser: false,
  },
}

// Helper to get raw body
async function getRawBody(req: VercelRequest): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk) => {
      data += chunk
    })
    req.on('end', () => {
      resolve(data)
    })
    req.on('error', reject)
  })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const rawBody = await getRawBody(req)
    const signature = req.headers['stripe-signature']

    if (!signature || typeof signature !== 'string') {
      return res.status(400).json({ error: 'Missing stripe-signature header' })
    }

    const result = await handleWebhook(rawBody, signature)

    if (!result.success) {
      return res.status(400).json(result)
    }

    return res.status(200).json(result)
  } catch (error) {
    console.error('Stripe webhook error:', error)

    if (error instanceof Error && error.message.includes('signature')) {
      return res.status(400).json({ error: 'Invalid webhook signature' })
    }

    return res.status(500).json({ error: 'Webhook processing failed' })
  }
}
