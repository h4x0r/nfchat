import { useCallback } from 'react'
import { useStore, selectFilteredFlows } from '@/lib/store'
import { chat } from '@/lib/api-client'
import { FlowTable } from '../dashboard/FlowTable'
import { Chat } from '../Chat'
import { StatsBar } from './StatsBar'

// Column name mappings for readable filter messages
const COLUMN_LABELS: Record<string, string> = {
  IPV4_SRC_ADDR: 'source IP',
  IPV4_DST_ADDR: 'destination IP',
  L4_SRC_PORT: 'source port',
  L4_DST_PORT: 'destination port',
  PROTOCOL: 'protocol',
  Attack: 'attack type',
  IN_BYTES: 'in bytes',
  OUT_BYTES: 'out bytes',
}

/**
 * Forensic analysis dashboard with split-view layout.
 * Left: Flow table (65%) for data exploration
 * Right: Chat panel (35%) always visible for NL queries
 */
export function ForensicDashboard() {
  // Store state
  const flows = useStore(selectFilteredFlows)
  const totalFlowCount = useStore((s) => s.totalFlowCount)
  const messages = useStore((s) => s.messages)
  const isLoading = useStore((s) => s.isLoading)
  const addMessage = useStore((s) => s.addMessage)
  const setIsLoading = useStore((s) => s.setIsLoading)

  // Process a chat message through the AI
  const processChat = useCallback(
    async (message: string) => {
      // Add user message
      addMessage({ role: 'user', content: message })

      // Call AI
      setIsLoading(true)
      try {
        const result = await chat(message)
        addMessage({
          role: 'assistant',
          content: result.response,
          sql: result.queries.length > 0 ? result.queries.join('\n') : undefined,
        })
      } catch (error) {
        addMessage({
          role: 'assistant',
          content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        })
      } finally {
        setIsLoading(false)
      }
    },
    [addMessage, setIsLoading]
  )

  // Handle cell click - send filter query to chat
  const handleCellClick = useCallback(
    (column: string, value: string) => {
      const label = COLUMN_LABELS[column] || column
      const query = `Filter by ${label} = ${value}`
      processChat(query)
    },
    [processChat]
  )

  // Handle chat send
  const handleChatSend = useCallback(
    (message: string) => {
      processChat(message)
    },
    [processChat]
  )

  return (
    <div
      data-testid="forensic-dashboard"
      className="flex flex-col h-screen bg-background"
    >
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-border">
        <h1 className="text-lg font-semibold">nfchat</h1>
        <div className="flex items-center gap-2">
          {/* Settings button placeholder */}
        </div>
      </header>

      {/* Stats Bar */}
      <StatsBar onFilter={handleCellClick} />

      {/* Split View: Table + Chat */}
      <div className="flex flex-1 min-h-0">
        {/* Left: Flow Table (65%) */}
        <div className="w-[65%] border-r border-border overflow-hidden">
          <FlowTable
            data={flows}
            totalCount={totalFlowCount}
            onCellClick={handleCellClick}
          />
        </div>

        {/* Right: Chat Panel (35%) */}
        <div className="w-[35%] overflow-hidden">
          <Chat
            messages={messages}
            onSend={handleChatSend}
            isLoading={isLoading}
          />
        </div>
      </div>
    </div>
  )
}
