/**
 * Stripe Integration
 *
 * Handles credit pack purchases via Stripe Checkout
 */

import Stripe from 'stripe'
import { addCredits, recordPurchase } from '../db/client'

// Credit pack definitions from design doc
export const CREDIT_PACKS = {
  starter: { credits: 20, price_cents: 500, name: 'Starter Pack' },
  pro: { credits: 100, price_cents: 2000, name: 'Pro Pack' },
  team: { credits: 500, price_cents: 7500, name: 'Team Pack' },
} as const

export type PackType = keyof typeof CREDIT_PACKS

function getStripe(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY not configured')
  }
  return new Stripe(secretKey)
}

export interface CheckoutSessionResult {
  sessionId: string
  url: string
}

/**
 * Create a Stripe Checkout session for credit purchase
 */
export async function createCheckoutSession(
  userId: string,
  packType: PackType
): Promise<CheckoutSessionResult> {
  const pack = CREDIT_PACKS[packType]

  if (!pack) {
    throw new Error('Invalid credit pack')
  }

  const stripe = getStripe()
  const appUrl = process.env.APP_URL || 'http://localhost:3000'

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: pack.name,
            description: `${pack.credits} AI analysis credits for nfchat`,
          },
          unit_amount: pack.price_cents,
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: `${appUrl}?purchase=success`,
    cancel_url: `${appUrl}?purchase=cancelled`,
    metadata: {
      user_id: userId,
      pack_type: packType,
    },
  })

  return {
    sessionId: session.id,
    url: session.url || '',
  }
}

export interface WebhookResult {
  success: boolean
  message?: string
}

/**
 * Handle Stripe webhook events
 */
export async function handleWebhook(
  payload: string,
  signature: string
): Promise<WebhookResult> {
  const stripe = getStripe()
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET not configured')
  }

  // Verify webhook signature
  const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret)

  // Only process checkout completion
  if (event.type !== 'checkout.session.completed') {
    return { success: true, message: `Ignored event type: ${event.type}` }
  }

  const session = event.data.object as Stripe.Checkout.Session
  const { user_id, pack_type } = session.metadata || {}

  if (!user_id || !pack_type) {
    console.error('Missing metadata in checkout session:', session.id)
    return { success: false, message: 'Missing metadata' }
  }

  const pack = CREDIT_PACKS[pack_type as PackType]
  if (!pack) {
    console.error('Invalid pack type in metadata:', pack_type)
    return { success: false, message: 'Invalid pack type' }
  }

  // Add credits to user
  await addCredits(user_id, pack.credits)

  // Record the purchase
  await recordPurchase(
    user_id,
    session.id,
    pack.credits,
    session.amount_total || pack.price_cents
  )

  return { success: true, message: `Added ${pack.credits} credits to user ${user_id}` }
}
