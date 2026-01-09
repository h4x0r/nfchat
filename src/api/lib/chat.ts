/**
 * Chat API Logic
 *
 * Handles AI-driven data fetching flow:
 * 1. Determine what queries the AI needs to answer the question
 * 2. Analyze data with AI and return response
 */

import Anthropic from '@anthropic-ai/sdk'

const MAX_LIMIT = 10000
const DEFAULT_LIMIT = 1000

// Netflow schema for the AI to understand
const NETFLOW_SCHEMA = `
Available columns in the 'flows' table:
- FLOW_START_MILLISECONDS (BIGINT): Flow start timestamp
- FLOW_END_MILLISECONDS (BIGINT): Flow end timestamp
- IPV4_SRC_ADDR (VARCHAR): Source IP address
- L4_SRC_PORT (BIGINT): Source port
- IPV4_DST_ADDR (VARCHAR): Destination IP address
- L4_DST_PORT (BIGINT): Destination port
- PROTOCOL (BIGINT): IP protocol number (6=TCP, 17=UDP, 1=ICMP)
- IN_BYTES (BIGINT): Incoming bytes
- OUT_BYTES (BIGINT): Outgoing bytes
- IN_PKTS (BIGINT): Incoming packets
- OUT_PKTS (BIGINT): Outgoing packets
- TCP_FLAGS (BIGINT): TCP flags
- FLOW_DURATION_MILLISECONDS (BIGINT): Flow duration
- Attack (VARCHAR): Attack type label (e.g., 'Benign', 'Exploits', 'DoS', 'Fuzzers', etc.)
- Label (BIGINT): Binary label (0=benign, 1=attack)
`

/**
 * Build the system prompt for the AI
 */
export function buildSystemPrompt(): string {
  return `You are a network security analyst assistant helping analyze NetFlow data.

${NETFLOW_SCHEMA}

When asked questions about the network data:
1. Generate SQL queries to answer the question
2. Only use SELECT statements
3. Always include reasonable LIMIT clauses
4. Focus on security-relevant analysis

Respond with JSON containing the SQL queries needed.`
}

/**
 * Validate SQL is safe to execute (SELECT only)
 */
export function validateSQL(sql: string): boolean {
  const normalized = sql.trim().toUpperCase()

  // Must start with SELECT
  if (!normalized.startsWith('SELECT')) return false

  // Block dangerous keywords
  const forbidden = ['DROP', 'DELETE', 'INSERT', 'UPDATE', 'ALTER', 'CREATE', 'TRUNCATE', 'EXEC', 'EXECUTE']
  for (const keyword of forbidden) {
    // Check for keyword as whole word
    const regex = new RegExp(`\\b${keyword}\\b`)
    if (regex.test(normalized)) return false
  }

  return true
}

/**
 * Sanitize SQL by adding LIMIT if missing
 */
export function sanitizeSQL(sql: string): string {
  const normalized = sql.trim().toUpperCase()

  if (!normalized.includes('LIMIT')) {
    return `${sql.trim()} LIMIT ${DEFAULT_LIMIT}`
  }

  // Check if limit exceeds max
  const limitMatch = normalized.match(/LIMIT\s+(\d+)/)
  if (limitMatch) {
    const limit = parseInt(limitMatch[1], 10)
    if (limit > MAX_LIMIT) {
      return sql.replace(/LIMIT\s+\d+/i, `LIMIT ${MAX_LIMIT}`)
    }
  }

  return sql
}

interface DetermineQueriesResult {
  queries: string[]
  reasoning?: string
}

/**
 * Ask AI what queries it needs to answer the question
 */
export async function determineNeededQueries(question: string): Promise<DetermineQueriesResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY

  // For simple greetings or non-data questions, return empty
  const lowerQuestion = question.toLowerCase()
  if (
    lowerQuestion.match(/^(hi|hello|hey|thanks|thank you|bye|goodbye)/i) ||
    lowerQuestion.length < 10
  ) {
    return { queries: [] }
  }

  if (!apiKey) {
    // Without API key, return common queries based on keywords
    return generateFallbackQueries(question)
  }

  const client = new Anthropic({ apiKey })

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: buildSystemPrompt(),
    messages: [
      {
        role: 'user',
        content: `I need to answer this question about network flow data: "${question}"

Return a JSON object with:
- queries: array of SQL SELECT queries needed to answer this question
- reasoning: brief explanation of what data you need

Only include queries that are necessary. Maximum 3 queries.`,
      },
    ],
  })

  try {
    const content = response.content[0]
    if (content.type === 'text') {
      // Extract JSON from response
      const jsonMatch = content.text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        // Validate and sanitize each query
        const validQueries = (parsed.queries || [])
          .filter((q: string) => validateSQL(q))
          .map((q: string) => sanitizeSQL(q))
        return { queries: validQueries, reasoning: parsed.reasoning }
      }
    }
  } catch (e) {
    console.error('Failed to parse AI response:', e)
  }

  return generateFallbackQueries(question)
}

/**
 * Generate fallback queries based on keywords when AI is unavailable
 */
function generateFallbackQueries(question: string): DetermineQueriesResult {
  const lowerQuestion = question.toLowerCase()
  const queries: string[] = []

  if (lowerQuestion.includes('attack') || lowerQuestion.includes('threat')) {
    queries.push("SELECT Attack, COUNT(*) as count FROM flows GROUP BY Attack ORDER BY count DESC LIMIT 20")
  }

  if (lowerQuestion.includes('ip') || lowerQuestion.includes('source') || lowerQuestion.includes('address')) {
    queries.push("SELECT IPV4_SRC_ADDR as ip, COUNT(*) as count FROM flows GROUP BY IPV4_SRC_ADDR ORDER BY count DESC LIMIT 20")
  }

  if (lowerQuestion.includes('port') || lowerQuestion.includes('scan')) {
    queries.push("SELECT IPV4_SRC_ADDR, COUNT(DISTINCT L4_DST_PORT) as ports FROM flows GROUP BY IPV4_SRC_ADDR HAVING ports > 10 ORDER BY ports DESC LIMIT 20")
  }

  if (lowerQuestion.includes('traffic') || lowerQuestion.includes('bytes') || lowerQuestion.includes('volume')) {
    queries.push("SELECT IPV4_SRC_ADDR, SUM(IN_BYTES + OUT_BYTES) as total_bytes FROM flows GROUP BY IPV4_SRC_ADDR ORDER BY total_bytes DESC LIMIT 20")
  }

  // Default query if nothing matches
  if (queries.length === 0) {
    queries.push("SELECT Attack, COUNT(*) as count FROM flows GROUP BY Attack ORDER BY count DESC LIMIT 20")
  }

  return { queries }
}

interface AnalyzeResult {
  response: string
}

/**
 * Analyze data with AI and return response
 */
export async function analyzeWithData(
  question: string,
  data: unknown[]
): Promise<AnalyzeResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    return {
      response: `Based on the data provided, I can see ${data.length} records. Please configure your API key for detailed AI analysis.`,
    }
  }

  const client = new Anthropic({ apiKey })

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system: `You are a network security analyst. Analyze the provided NetFlow data and answer the user's question. Be concise but thorough. Highlight any security concerns.`,
    messages: [
      {
        role: 'user',
        content: `Question: ${question}

Data from queries:
${JSON.stringify(data, null, 2)}

Please analyze this data and answer the question. Focus on security implications.`,
      },
    ],
  })

  const content = response.content[0]
  if (content.type === 'text') {
    return { response: content.text }
  }

  return { response: 'Unable to generate analysis.' }
}
