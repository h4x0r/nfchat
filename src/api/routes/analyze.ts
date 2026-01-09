/**
 * Chat Analyze Handler
 *
 * Handles the second step of the AI-driven data fetching flow:
 * Accept query results, return AI analysis
 */

import { verifyTurnstileToken } from '../lib/turnstile'
import { analyzeWithData } from '../lib/chat'

export interface AnalyzeRequest {
  question: string
  data: unknown[]
  turnstileToken: string
  clientIP: string
  userId?: string
}

export interface AnalyzeResponse {
  success: boolean
  response?: string
  error?: string
}

/**
 * Handle a chat analyze request
 */
export async function handleAnalyze(req: AnalyzeRequest): Promise<AnalyzeResponse> {
  const { question, data, turnstileToken, clientIP } = req

  // Validate required fields
  if (!question || question.trim().length === 0) {
    return { success: false, error: 'Missing question' }
  }

  if (data === undefined || data === null) {
    return { success: false, error: 'Missing data' }
  }

  if (!turnstileToken || turnstileToken.trim().length === 0) {
    return { success: false, error: 'Missing turnstile token' }
  }

  // Verify Turnstile token
  const turnstileResult = await verifyTurnstileToken(turnstileToken, clientIP)
  if (!turnstileResult.success) {
    return { success: false, error: `Turnstile verification failed: ${turnstileResult.error}` }
  }

  // Get analysis from AI
  const result = await analyzeWithData(question, data)

  return {
    success: true,
    response: result.response,
  }
}
