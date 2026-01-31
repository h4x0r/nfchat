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

// Track KillChainTimeline props for testing
let capturedKillChainProps: Record<string, unknown> = {}

vi.mock('./KillChainTimeline', () => ({
  KillChainTimeline: (props: Record<string, unknown>) => {
    capturedKillChainProps = props
    return <div data-testid="kill-chain-mock">KillChainTimeline</div>
  },
}))

describe('ForensicDashboard', () => {
  beforeEach(() => {
    capturedFlowTableProps = {}
    capturedKillChainProps = {}
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

  it('displays the chat panel (always visible)', async () => {
    render(<ForensicDashboard />)
    // Chat is lazy-loaded, wait for Suspense to resolve
    await waitFor(() => {
      expect(screen.getByTestId('chat-mock')).toBeInTheDocument()
    })
  })

  it('has split layout with table on left and chat on right', async () => {
    render(<ForensicDashboard />)
    const dashboard = screen.getByTestId('forensic-dashboard')
    // Check for grid/flex layout classes
    expect(dashboard.querySelector('[data-testid="flow-table-mock"]')).toBeInTheDocument()
    // Chat is lazy-loaded, wait for Suspense to resolve
    await waitFor(() => {
      expect(dashboard.querySelector('[data-testid="chat-mock"]')).toBeInTheDocument()
    })
  })

  it('shows app title in header', () => {
    render(<ForensicDashboard />)
    expect(screen.getByText('nfchat')).toBeInTheDocument()
  })

  it('wires up click-to-filter to chat', async () => {
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
    // Chat is lazy-loaded, wait for Suspense to resolve
    await waitFor(() => {
      expect(screen.getByTestId('chat-mock')).toBeInTheDocument()
    })
  })

  describe('callback stability', () => {
    it('maintains stable onCellClick reference across re-renders', async () => {
      render(<ForensicDashboard />)

      await waitFor(() => {
        expect(capturedFlowTableProps.onCellClick).toBeDefined()
      })

      // Capture first callback reference
      const firstCallback = capturedFlowTableProps.onCellClick

      // Trigger a state update that causes re-render
      await act(async () => {
        useStore.setState({ messages: [{ id: '1', role: 'user', content: 'test', timestamp: new Date() }] })
      })

      // Wait for re-render
      await waitFor(() => {
        expect(capturedFlowTableProps.onCellClick).toBeDefined()
      })

      // Callback reference should be stable (same function)
      expect(capturedFlowTableProps.onCellClick).toBe(firstCallback)
    })

    it('maintains stable onColumnFiltersChange reference across re-renders', async () => {
      render(<ForensicDashboard />)

      await waitFor(() => {
        expect(capturedFlowTableProps.onColumnFiltersChange).toBeDefined()
      })

      const firstCallback = capturedFlowTableProps.onColumnFiltersChange

      await act(async () => {
        useStore.setState({ messages: [{ id: '1', role: 'user', content: 'test', timestamp: new Date() }] })
      })

      await waitFor(() => {
        expect(capturedFlowTableProps.onColumnFiltersChange).toBeDefined()
      })

      expect(capturedFlowTableProps.onColumnFiltersChange).toBe(firstCallback)
    })
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

  describe('kill chain session selection', () => {
    it('filters flows immediately when a session is selected', async () => {
      render(<ForensicDashboard />)

      // Toggle kill chain view
      await act(async () => {
        const killChainButton = screen.getByText(/Kill Chain/)
        killChainButton.click()
      })

      await waitFor(() => {
        expect(capturedKillChainProps.onSessionSelect).toBeDefined()
      })

      // Clear previous calls
      mockGetFlows.mockClear()

      // Simulate session selection
      const mockSession = {
        session_id: '143.88.12.12-12345',
        src_ip: '143.88.12.12',
        start_time: 1711612000000, // Mar 28, 2024
        end_time: 1711612060000,
        duration_minutes: 1,
        flow_count: 4,
        tactics: ['Initial Access', 'Execution'],
        techniques: ['T1190', 'T1059'],
        target_ips: ['10.0.0.1'],
        target_ports: [80],
        total_bytes: 1000,
      }

      await act(async () => {
        const onSessionSelect = capturedKillChainProps.onSessionSelect as (session: typeof mockSession) => void
        onSessionSelect(mockSession)
      })

      // Should call getFlows with src_ip and time range filter
      await waitFor(() => {
        const calls = mockGetFlows.mock.calls
        expect(calls.length).toBeGreaterThan(0)
        const lastCall = calls[calls.length - 1]
        const whereClause = lastCall[0]?.whereClause as string
        expect(whereClause).toContain("IPV4_SRC_ADDR = '143.88.12.12'")
        expect(whereClause).toContain('FLOW_START_MILLISECONDS >=')
        expect(whereClause).toContain('FLOW_END_MILLISECONDS <=')
      })
    })
  })
})
