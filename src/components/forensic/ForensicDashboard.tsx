import { useCallback, useEffect, useRef, useState, lazy, Suspense } from 'react'
import { useStore } from '@/lib/store'
import { useTablePageSize } from '@/hooks/useTablePageSize'
import { chat, getFlows } from '@/lib/api-client'
import { FlowTable } from '../dashboard/FlowTable'
import { StatsBar } from './StatsBar'
import { logger } from '@/lib/logger'
import { WhereClauseBuilder } from '@/lib/sql'
import type { ColumnFiltersState } from '@tanstack/react-table'
import type { AttackSession } from '@/lib/motherduck/types'

// Lazy load heavy components - Chat pulls in react-markdown, KillChainTimeline is complex
const Chat = lazy(() => import('../Chat').then(m => ({ default: m.Chat })))
const KillChainTimeline = lazy(() => import('./KillChainTimeline').then(m => ({ default: m.KillChainTimeline })))

const dashboardLogger = logger.child('Dashboard')

/**
 * Suspense fallback for lazy-loaded side panels.
 */
function PanelLoadingFallback() {
  return (
    <div className="flex items-center justify-center h-full text-muted-foreground">
      Loading...
    </div>
  )
}

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
 * Build SQL WHERE clause from column filters using safe SQL builder.
 * Handles both string filters (LIKE) and array filters (IN).
 */
function buildColumnFilterSQL(filters: ColumnFiltersState): string {
  const builder = new WhereClauseBuilder()

  for (const filter of filters) {
    const { id, value } = filter

    if (Array.isArray(value) && value.length > 0) {
      // Array filter (e.g., Attack multi-select) → IN clause
      builder.addInClause(id, value.map(String))
    } else if (typeof value === 'string' && value.trim().length > 0) {
      // String filter → LIKE clause for partial matching
      builder.addLike(id, value)
    }
  }

  // Return empty string if no conditions (not '1=1' since this appends to existing)
  return builder.hasConditions() ? builder.build() : ''
}

/**
 * Forensic analysis dashboard with split-view layout.
 * Left: Flow table (65%) for data exploration
 * Right: Chat panel (35%) always visible for NL queries
 */
export function ForensicDashboard() {
  // Ref for dynamic page size calculation
  const tableContainerRef = useRef<HTMLDivElement>(null)
  const dynamicPageSize = useTablePageSize(tableContainerRef)

  // Local state for page data (server-side paginated)
  const [pageFlows, setPageFlows] = useState<Partial<import('@/lib/schema').FlowRecord>[]>([])
  const [filteredTotalCount, setFilteredTotalCount] = useState(0)
  const [pageLoading, setPageLoading] = useState(false)
  const [pageError, setPageError] = useState<string | null>(null)

  // Column filters state - lifted from FlowTable for server-side filtering
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  // Kill Chain Timeline panel state
  const [showKillChain, setShowKillChain] = useState(false)
  const [_selectedSession, setSelectedSession] = useState<AttackSession | null>(null)

  // Store state - primitive selectors are already optimal (no object comparison needed)
  const hideBenign = useStore((s) => s.hideBenign)
  const currentPage = useStore((s) => s.currentPage)
  const messages = useStore((s) => s.messages)
  const isLoading = useStore((s) => s.isLoading)

  // Store actions - individual selectors for stable references
  const addMessage = useStore((s) => s.addMessage)
  const setIsLoading = useStore((s) => s.setIsLoading)
  const setCurrentPage = useStore((s) => s.setCurrentPage)

  // Pagination state (use dynamic page size)
  const pageSize = dynamicPageSize

  // Calculate total pages from filtered count
  const displayedTotalPages = Math.ceil(filteredTotalCount / pageSize) || 1

  // Server-side filter and paginate - reload when hideBenign, columnFilters, page, or pageSize changes
  // Uses lightweight getFlows endpoint (only 2 queries vs 6 in getDashboardData)
  useEffect(() => {
    let cancelled = false

    async function loadPage() {
      setPageLoading(true)
      setPageError(null)
      try {
        // Build combined WHERE clause from hideBenign + column filters
        const conditions: string[] = []
        if (hideBenign) {
          conditions.push("Attack != 'Benign'")
        }
        const columnFilterSQL = buildColumnFilterSQL(columnFilters)
        if (columnFilterSQL) {
          conditions.push(columnFilterSQL)
        }
        const whereClause = conditions.length > 0 ? conditions.join(' AND ') : '1=1'

        const data = await getFlows({
          whereClause,
          limit: pageSize,
          offset: currentPage * pageSize,
        })

        if (!cancelled) {
          setPageFlows(data.flows)
          setFilteredTotalCount(data.totalCount)
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to load data'
        dashboardLogger.error('Failed to load page', {
          error: errorMessage,
          page: currentPage,
          pageSize,
          hideBenign,
        })
        if (!cancelled) {
          setPageError(errorMessage)
        }
      } finally {
        if (!cancelled) {
          setPageLoading(false)
        }
      }
    }

    loadPage()

    return () => {
      cancelled = true
    }
  }, [hideBenign, columnFilters, currentPage, pageSize])

  // Track previous hideBenign to detect changes (not initial mount)
  const prevHideBenignRef = useRef(hideBenign)
  useEffect(() => {
    // Only reset page when hideBenign actually changes (not on mount)
    if (prevHideBenignRef.current !== hideBenign) {
      prevHideBenignRef.current = hideBenign
      if (currentPage !== 0) {
        setCurrentPage(0)
      }
    }
  }, [hideBenign, currentPage, setCurrentPage])

  // Handle column filter changes - update state and reset pagination
  // TanStack Table's onChange can receive a value OR an updater function
  const handleColumnFiltersChange = useCallback(
    (updaterOrValue: ColumnFiltersState | ((old: ColumnFiltersState) => ColumnFiltersState)) => {
      const newFilters = typeof updaterOrValue === 'function'
        ? updaterOrValue(columnFilters)
        : updaterOrValue
      setColumnFilters(newFilters)
      // Reset to page 0 when filters change
      if (currentPage !== 0) {
        setCurrentPage(0)
      }
    },
    [columnFilters, currentPage, setCurrentPage]
  )

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
          <button
            onClick={() => setShowKillChain(!showKillChain)}
            className={`px-3 py-1 text-sm rounded border transition-colors ${
              showKillChain
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border hover:bg-muted'
            }`}
          >
            {showKillChain ? '✕ Kill Chain' : '⚔ Kill Chain'}
          </button>
        </div>
      </header>

      {/* Stats Bar */}
      <StatsBar onFilter={handleCellClick} />

      {/* Split View: Table + Chat */}
      <div className="flex flex-1 min-h-0">
        {/* Left: Flow Table (65%) */}
        <div ref={tableContainerRef} className="w-[65%] border-r border-border overflow-hidden">
          <FlowTable
            data={pageFlows}
            loading={pageLoading}
            error={pageError}
            onRetry={() => setCurrentPage(currentPage)}
            totalCount={filteredTotalCount}
            onCellClick={handleCellClick}
            currentPage={currentPage}
            totalPages={displayedTotalPages}
            onPageChange={setCurrentPage}
            columnFilters={columnFilters}
            onColumnFiltersChange={handleColumnFiltersChange}
          />
        </div>

        {/* Right: Chat or Kill Chain Panel (35%) */}
        <div className="w-[35%] overflow-hidden flex flex-col">
          <Suspense fallback={<PanelLoadingFallback />}>
            {showKillChain ? (
              <KillChainTimeline
                onSessionSelect={(session) => {
                  setSelectedSession(session)
                  // Optionally filter flows to this session
                  const query = `Show flows from ${session.src_ip} between ${new Date(session.start_time).toISOString()} and ${new Date(session.end_time).toISOString()}`
                  processChat(query)
                }}
                className="h-full"
              />
            ) : (
              <Chat
                messages={messages}
                onSend={handleChatSend}
                isLoading={isLoading}
              />
            )}
          </Suspense>
        </div>
      </div>
    </div>
  )
}
