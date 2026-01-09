/**
 * Rate Limiting Logic
 *
 * Tiers:
 * - Free (anonymous): 2 queries/day
 * - Authenticated: 10 queries/day
 * - Paid: Use credits beyond daily limit
 */

const LIMITS = {
  FREE: 2,
  AUTHENTICATED: 10,
} as const

export type RateLimitTier = 'free' | 'authenticated' | 'paid'

export interface CheckRateLimitParams {
  ip?: string
  userId?: string
  currentCount: number
  credits?: number
}

export interface CheckRateLimitResult {
  allowed: boolean
  remaining: number
  tier: RateLimitTier
}

export interface GetRemainingParams {
  currentCount: number
  credits: number
  isAuthenticated: boolean
}

export interface RemainingQueries {
  daily: number
  credits: number
  total: number
}

/**
 * Check if a user/IP can make another query
 */
export function checkRateLimit(params: CheckRateLimitParams): CheckRateLimitResult {
  const { userId, currentCount, credits = 0 } = params

  // Determine tier and limit
  const isAuthenticated = !!userId
  const dailyLimit = isAuthenticated ? LIMITS.AUTHENTICATED : LIMITS.FREE
  const dailyRemaining = Math.max(0, dailyLimit - currentCount)

  // If user has credits and exceeded daily limit, use credits
  if (currentCount >= dailyLimit && credits > 0) {
    return {
      allowed: true,
      remaining: credits,
      tier: 'paid',
    }
  }

  // Check daily limit
  if (currentCount >= dailyLimit) {
    return {
      allowed: false,
      remaining: 0,
      tier: isAuthenticated ? 'authenticated' : 'free',
    }
  }

  // Within daily limit
  return {
    allowed: true,
    remaining: dailyRemaining,
    tier: isAuthenticated ? 'authenticated' : 'free',
  }
}

/**
 * Get remaining queries for display
 */
export function getRemainingQueries(params: GetRemainingParams): RemainingQueries {
  const { currentCount, credits, isAuthenticated } = params
  const dailyLimit = isAuthenticated ? LIMITS.AUTHENTICATED : LIMITS.FREE
  const dailyRemaining = Math.max(0, dailyLimit - currentCount)

  return {
    daily: dailyRemaining,
    credits,
    total: dailyRemaining + credits,
  }
}
