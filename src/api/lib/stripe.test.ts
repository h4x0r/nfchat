/**
 * Stripe Integration Tests (TDD)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Mock Stripe at module level
const mockCreate = vi.fn()
const mockConstructEvent = vi.fn()

vi.mock('stripe', () => {
  return {
    default: class MockStripe {
      checkout = {
        sessions: {
          create: mockCreate,
        },
      }
      webhooks = {
        constructEvent: mockConstructEvent,
      }
    },
  }
})

// Mock database client
vi.mock('../db/client', () => ({
  addCredits: vi.fn(),
  recordPurchase: vi.fn(),
  getUserById: vi.fn(),
}))

describe('Stripe Integration', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.clearAllMocks()
    process.env = {
      ...originalEnv,
      STRIPE_SECRET_KEY: 'sk_test_123',
      STRIPE_WEBHOOK_SECRET: 'whsec_test',
      APP_URL: 'http://localhost:3000',
    }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('CREDIT_PACKS', () => {
    it('defines credit pack pricing', async () => {
      const { CREDIT_PACKS } = await import('./stripe')

      expect(CREDIT_PACKS.starter.credits).toBe(20)
      expect(CREDIT_PACKS.starter.price_cents).toBe(500) // $5

      expect(CREDIT_PACKS.pro.credits).toBe(100)
      expect(CREDIT_PACKS.pro.price_cents).toBe(2000) // $20

      expect(CREDIT_PACKS.team.credits).toBe(500)
      expect(CREDIT_PACKS.team.price_cents).toBe(7500) // $75
    })
  })

  describe('createCheckoutSession', () => {
    it('creates a Stripe checkout session', async () => {
      mockCreate.mockResolvedValue({
        id: 'cs_test_123',
        url: 'https://checkout.stripe.com/pay/cs_test_123',
      })

      const { createCheckoutSession } = await import('./stripe')
      const result = await createCheckoutSession('user-uuid', 'starter')

      expect(result.sessionId).toBe('cs_test_123')
      expect(result.url).toContain('stripe.com')
      expect(mockCreate).toHaveBeenCalled()
    })

    it('throws error for invalid pack type', async () => {
      const { createCheckoutSession } = await import('./stripe')

      await expect(
        createCheckoutSession('user-uuid', 'invalid' as never)
      ).rejects.toThrow('Invalid credit pack')
    })
  })

  describe('handleWebhook', () => {
    it('processes checkout.session.completed event', async () => {
      const { addCredits, recordPurchase } = await import('../db/client')
      vi.mocked(addCredits).mockResolvedValue(120)
      vi.mocked(recordPurchase).mockResolvedValue(undefined)

      mockConstructEvent.mockReturnValue({
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_123',
            metadata: {
              user_id: 'user-uuid',
              pack_type: 'pro',
            },
            amount_total: 2000,
          },
        },
      })

      const { handleWebhook } = await import('./stripe')
      const result = await handleWebhook('payload', 'sig_test')

      expect(result.success).toBe(true)
      expect(addCredits).toHaveBeenCalledWith('user-uuid', 100)
      expect(recordPurchase).toHaveBeenCalled()
    })

    it('ignores non-checkout events', async () => {
      mockConstructEvent.mockReturnValue({
        type: 'customer.subscription.created',
        data: { object: {} },
      })

      const { handleWebhook } = await import('./stripe')
      const result = await handleWebhook('payload', 'sig_test')

      expect(result.success).toBe(true)
      expect(result.message).toContain('Ignored')
    })

    it('throws on invalid signature', async () => {
      mockConstructEvent.mockImplementation(() => {
        throw new Error('Invalid signature')
      })

      const { handleWebhook } = await import('./stripe')

      await expect(handleWebhook('payload', 'bad_sig')).rejects.toThrow('Invalid signature')
    })
  })
})
