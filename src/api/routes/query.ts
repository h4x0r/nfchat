/**
 * Chat Query Handler
 *
 * Handles the first step of the AI-driven data fetching flow:
 * Accept a question, return SQL queries needed to answer it
 */

import { verifyTurnstileToken } from '../lib/turnstile'
import { determineNeededQueries } from '../lib/chat'

export interface QueryRequest {
  question: string
  turnstileToken: string
  clientIP: string
  userId?: string
}

export interface QueryResponse {
  success: boolean
  queries?: string[]
  reasoning?: string
  error?: string
}

/**
 * Handle a chat query request
 */
export async function handleQuery(req: QueryRequest): Promise<QueryResponse> {
  const { question, turnstileToken, clientIP } = req

  // Validate required fields
  if (!question || question.trim().length === 0) {
    return { success: false, error: 'Missing question' }
  }

  if (!turnstileToken || turnstileToken.trim().length === 0) {
    return { success: false, error: 'Missing turnstile token' }
  }

  // Verify Turnstile token
  const turnstileResult = await verifyTurnstileToken(turnstileToken, clientIP)
  if (!turnstileResult.success) {
    return { success: false, error: `Turnstile verification failed: ${turnstileResult.error}` }
  }

  // Get queries from AI
  const result = await determineNeededQueries(question)

  return {
    success: true,
    queries: result.queries,
    reasoning: result.reasoning,
  }
}
