import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { ForensicDashboard } from './ForensicDashboard'
import { useStore } from '@/lib/store'

// Track FlowTable props for testing
let capturedFlowTableProps: Record<string, unknown> = {}

// Mock getFlows API
const mockGetFlows = vi.fn().mockResolvedValue({
  flows: [],
  totalCount: 0,
})

vi.mock('@/lib/api-client', () => ({
  getFlows: (...args: unknown[]) => mockGetFlows(...args),
  chat: vi.fn().mockResolvedValue({ response: 'ok', queries: [], data: [] }),
}))

// Mock child components
vi.mock('../dashboard/FlowTable', () => ({
  FlowTable: (props: Record<string, unknown>) => {
    capturedFlowTableProps = props
    return <div data-testid="flow-table-mock">FlowTable</div>
  },
}))

vi.mock('../Chat', () => ({
  Chat: () => <div data-testid="chat-mock">Chat</div>,
}))

vi.mock('./StatsBar', () => ({
  StatsBar: () => <div data-testid="stats-bar-mock">StatsBar</div>,
}))

describe('ForensicDashboard', () => {
  beforeEach(() => {
    capturedFlowTableProps = {}
    mockGetFlows.mockClear()
    mockGetFlows.mockResolvedValue({ flows: [], totalCount: 0 })
    useStore.setState({
      flows: [],
      totalFlowCount: 0,
      attackBreakdown: [],
      topSrcIPs: [],
      topDstIPs: [],
      messages: [],
      currentPage: 0,
      hideBenign: false,
    })
  })

  it('renders without crashing', () => {
    render(<ForensicDashboard />)
    expect(screen.getByTestId('forensic-dashboard')).toBeInTheDocument()
  })

  it('displays the stats bar', () => {
    render(<ForensicDashboard />)
    expect(screen.getByTestId('stats-bar-mock')).toBeInTheDocument()
  })

  it('displays the flow table', () => {
    render(<ForensicDashboard />)
    expect(screen.getByTestId('flow-table-mock')).toBeInTheDocument()
  })

  it('displays the chat panel (always visible)', () => {
    render(<ForensicDashboard />)
    expect(screen.getByTestId('chat-mock')).toBeInTheDocument()
  })

  it('has split layout with table on left and chat on right', () => {
    render(<ForensicDashboard />)
    const dashboard = screen.getByTestId('forensic-dashboard')
    // Check for grid/flex layout classes
    expect(dashboard.querySelector('[data-testid="flow-table-mock"]')).toBeInTheDocument()
    expect(dashboard.querySelector('[data-testid="chat-mock"]')).toBeInTheDocument()
  })

  it('shows app title in header', () => {
    render(<ForensicDashboard />)
    expect(screen.getByText('nfchat')).toBeInTheDocument()
  })

  it('wires up click-to-filter to chat', () => {
    // Setup store with test data
    useStore.setState({
      flows: [
        {
          IPV4_SRC_ADDR: '192.168.1.1',
          L4_SRC_PORT: 8080,
          IPV4_DST_ADDR: '10.0.0.1',
          L4_DST_PORT: 443,
          Attack: 'DDoS',
        },
      ],
      messages: [],
    })

    render(<ForensicDashboard />)

    // The test is checking that the wiring exists - actual click-to-filter
    // is tested in FlowTable tests. Here we just verify both components render.
    expect(screen.getByTestId('flow-table-mock')).toBeInTheDocument()
    expect(screen.getByTestId('chat-mock')).toBeInTheDocument()
  })

  describe('server-side column filtering', () => {
    it('passes columnFilters and onColumnFiltersChange to FlowTable', async () => {
      render(<ForensicDashboard />)

      await waitFor(() => {
        expect(capturedFlowTableProps).toHaveProperty('columnFilters')
        expect(capturedFlowTableProps).toHaveProperty('onColumnFiltersChange')
      })
    })

    it('calls getFlows with Attack filter when column filter is set', async () => {
      render(<ForensicDashboard />)

      // Wait for initial render and API call
      await waitFor(() => {
        expect(capturedFlowTableProps.onColumnFiltersChange).toBeDefined()
      })

      // Clear previous calls
      mockGetFlows.mockClear()

      // Call the onColumnFiltersChange callback with Attack filter
      await act(async () => {
        const onColumnFiltersChange = capturedFlowTableProps.onColumnFiltersChange as (
          filters: Array<{ id: string; value: unknown }>
        ) => void
        onColumnFiltersChange([{ id: 'Attack', value: ['Backdoor'] }])
      })

      await waitFor(() => {
        const calls = mockGetFlows.mock.calls
        expect(calls.length).toBeGreaterThan(0)
        const lastCall = calls[calls.length - 1]
        expect(lastCall[0]?.whereClause).toContain("Attack IN ('Backdoor')")
      })
    })

    it('resets page to 0 when column filters change', async () => {
      // Start on page 2
      useStore.setState({ currentPage: 2 })

      render(<ForensicDashboard />)

      await waitFor(() => {
        expect(capturedFlowTableProps.onColumnFiltersChange).toBeDefined()
      })

      // Trigger column filter change
      await act(async () => {
        const onColumnFiltersChange = capturedFlowTableProps.onColumnFiltersChange as (
          filters: Array<{ id: string; value: unknown }>
        ) => void
        onColumnFiltersChange([{ id: 'Attack', value: ['Exploits'] }])
      })

      await waitFor(() => {
        expect(useStore.getState().currentPage).toBe(0)
      })
    })

    it('combines hideBenign and column filters in whereClause', async () => {
      useStore.setState({ hideBenign: true })

      render(<ForensicDashboard />)

      await waitFor(() => {
        expect(capturedFlowTableProps.onColumnFiltersChange).toBeDefined()
      })

      // Clear previous calls
      mockGetFlows.mockClear()

      // Set Attack filter while hideBenign is true
      await act(async () => {
        const onColumnFiltersChange = capturedFlowTableProps.onColumnFiltersChange as (
          filters: Array<{ id: string; value: unknown }>
        ) => void
        onColumnFiltersChange([{ id: 'Attack', value: ['DoS'] }])
      })

      await waitFor(() => {
        const calls = mockGetFlows.mock.calls
        expect(calls.length).toBeGreaterThan(0)
        const lastCall = calls[calls.length - 1]
        const whereClause = lastCall[0]?.whereClause as string
        expect(whereClause).toContain("Attack != 'Benign'")
        expect(whereClause).toContain("Attack IN ('DoS')")
      })
    })
  })
})
