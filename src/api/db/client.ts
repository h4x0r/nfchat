/**
 * Database Client for Vercel Postgres
 *
 * Provides typed database operations for the nfchat API
 */

import { sql } from '@vercel/postgres'
import crypto from 'crypto'

// User types
export interface User {
  id: string
  github_id: number
  github_login: string
  email?: string
  credits: number
  created_at?: Date
  updated_at?: Date
}

export interface CreateUserParams {
  github_id: number
  github_login: string
  email?: string
}

// Conversation types
export interface Conversation {
  id: string
  user_id?: string
  session_id: string
  created_at?: Date
}

export interface CreateConversationParams {
  sessionId: string
  userId?: string
}

// Message types
export interface Message {
  id: string
  conversation_id: string
  role: 'user' | 'assistant' | 'data_request' | 'data_response'
  content: unknown
  created_at?: Date
}

export interface SaveMessageParams {
  conversationId: string
  role: Message['role']
  content: unknown
}

// Rate limit types
export interface RateLimitParams {
  userId?: string
  ipAddress?: string
}

/**
 * Hash an IP address for privacy
 */
function hashIP(ip: string): string {
  return crypto.createHash('sha256').update(ip).digest('hex')
}

/**
 * Get a user by their GitHub ID
 */
export async function getUserByGithubId(githubId: number): Promise<User | null> {
  const result = await sql`
    SELECT id, github_id, github_login, email, credits
    FROM users
    WHERE github_id = ${githubId}
  `
  return result.rows[0] as User || null
}

/**
 * Get a user by their internal ID
 */
export async function getUserById(id: string): Promise<User | null> {
  const result = await sql`
    SELECT id, github_id, github_login, email, credits
    FROM users
    WHERE id = ${id}
  `
  return result.rows[0] as User || null
}

/**
 * Create a new user from GitHub OAuth
 */
export async function createUser(params: CreateUserParams): Promise<User> {
  const { github_id, github_login, email } = params
  const result = await sql`
    INSERT INTO users (github_id, github_login, email)
    VALUES (${github_id}, ${github_login}, ${email || null})
    RETURNING id, github_id, github_login, email, credits
  `
  return result.rows[0] as User
}

/**
 * Update user's GitHub info (on each login)
 */
export async function updateUser(githubId: number, params: Partial<CreateUserParams>): Promise<User> {
  const { github_login, email } = params
  const result = await sql`
    UPDATE users
    SET github_login = COALESCE(${github_login || null}, github_login),
        email = COALESCE(${email || null}, email)
    WHERE github_id = ${githubId}
    RETURNING id, github_id, github_login, email, credits
  `
  return result.rows[0] as User
}

/**
 * Get the current rate limit count for a user or IP
 */
export async function getRateLimitCount(params: RateLimitParams): Promise<number> {
  const { userId, ipAddress } = params

  if (userId) {
    const result = await sql`
      SELECT count FROM rate_limits_users
      WHERE user_id = ${userId} AND date = CURRENT_DATE
    `
    return result.rows[0]?.count ?? 0
  }

  if (ipAddress) {
    const ipHash = hashIP(ipAddress)
    const result = await sql`
      SELECT count FROM rate_limits_anonymous
      WHERE ip_hash = ${ipHash} AND date = CURRENT_DATE
    `
    return result.rows[0]?.count ?? 0
  }

  return 0
}

/**
 * Increment the rate limit count
 */
export async function incrementRateLimit(params: RateLimitParams): Promise<number> {
  const { userId, ipAddress } = params

  if (userId) {
    const result = await sql`
      INSERT INTO rate_limits_users (user_id, date, count)
      VALUES (${userId}, CURRENT_DATE, 1)
      ON CONFLICT (user_id, date)
      DO UPDATE SET count = rate_limits_users.count + 1
      RETURNING count
    `
    return result.rows[0]?.count ?? 1
  }

  if (ipAddress) {
    const ipHash = hashIP(ipAddress)
    const result = await sql`
      INSERT INTO rate_limits_anonymous (ip_hash, date, count)
      VALUES (${ipHash}, CURRENT_DATE, 1)
      ON CONFLICT (ip_hash, date)
      DO UPDATE SET count = rate_limits_anonymous.count + 1
      RETURNING count
    `
    return result.rows[0]?.count ?? 1
  }

  return 0
}

/**
 * Deduct credits from a user
 */
export async function deductCredits(userId: string, amount: number): Promise<number> {
  const result = await sql`
    UPDATE users
    SET credits = credits - ${amount}
    WHERE id = ${userId} AND credits >= ${amount}
    RETURNING credits
  `

  if (result.rowCount === 0) {
    throw new Error('Insufficient credits')
  }

  return result.rows[0].credits
}

/**
 * Add credits to a user (after Stripe purchase)
 */
export async function addCredits(userId: string, amount: number): Promise<number> {
  const result = await sql`
    UPDATE users
    SET credits = credits + ${amount}
    WHERE id = ${userId}
    RETURNING credits
  `
  return result.rows[0]?.credits ?? 0
}

/**
 * Create a new conversation
 */
export async function createConversation(params: CreateConversationParams): Promise<Conversation> {
  const { sessionId, userId } = params
  const result = await sql`
    INSERT INTO conversations (session_id, user_id)
    VALUES (${sessionId}, ${userId || null})
    RETURNING id, session_id, user_id
  `
  return result.rows[0] as Conversation
}

/**
 * Get or create a conversation by session ID
 */
export async function getOrCreateConversation(params: CreateConversationParams): Promise<Conversation> {
  const { sessionId } = params

  // First try to find existing
  const existing = await sql`
    SELECT id, session_id, user_id FROM conversations
    WHERE session_id = ${sessionId}
  `

  if (existing.rows[0]) {
    return existing.rows[0] as Conversation
  }

  // Create new
  return createConversation(params)
}

/**
 * Save a message to a conversation
 */
export async function saveMessage(params: SaveMessageParams): Promise<Message> {
  const { conversationId, role, content } = params
  const result = await sql`
    INSERT INTO messages (conversation_id, role, content)
    VALUES (${conversationId}, ${role}, ${JSON.stringify(content)})
    RETURNING id, conversation_id, role, content
  `
  return result.rows[0] as Message
}

/**
 * Record a credit purchase
 */
export async function recordPurchase(
  userId: string,
  stripeId: string,
  credits: number,
  amountCents: number
): Promise<void> {
  await sql`
    INSERT INTO purchases (user_id, stripe_id, credits, amount_cents)
    VALUES (${userId}, ${stripeId}, ${credits}, ${amountCents})
  `
}
