import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { Dashboard } from './Dashboard'
import { useStore } from '@/lib/store'

// Store FlowTable mock props for inspection
let flowTableProps: Record<string, unknown> | null = null

// Mock child components to isolate Dashboard layout testing
vi.mock('./dashboard/timeline', () => ({
  ProTimeline: () => <div data-testid="timeline-mock">ProTimeline</div>,
}))

vi.mock('./dashboard/AttackBreakdown', () => ({
  AttackBreakdown: () => <div data-testid="attack-breakdown-mock">AttackBreakdown</div>,
}))

vi.mock('./dashboard/TopTalkers', () => ({
  TopTalkers: () => <div data-testid="top-talkers-mock">TopTalkers</div>,
}))

vi.mock('./dashboard/FlowTable', () => ({
  FlowTable: (props: Record<string, unknown>) => {
    flowTableProps = props
    return <div data-testid="flow-table-mock">FlowTable</div>
  },
}))

describe('Dashboard', () => {
  beforeEach(() => {
    flowTableProps = null
    // Reset store state
    useStore.setState({
      flows: [],
      selectedFlow: null,
      totalFlowCount: 0,
      timelineData: [],
      attackBreakdown: [],
      topSrcIPs: [],
      topDstIPs: [],
    })
  })

  afterEach(() => {
    flowTableProps = null
  })

  it('renders without crashing', () => {
    render(<Dashboard />)
    expect(screen.getByTestId('dashboard')).toBeInTheDocument()
  })

  it('displays the timeline component', () => {
    render(<Dashboard />)
    expect(screen.getByTestId('timeline-mock')).toBeInTheDocument()
  })

  it('displays the attack breakdown component', () => {
    render(<Dashboard />)
    expect(screen.getByTestId('attack-breakdown-mock')).toBeInTheDocument()
  })

  it('displays the top talkers components (src and dst)', () => {
    render(<Dashboard />)
    const topTalkers = screen.getAllByTestId('top-talkers-mock')
    expect(topTalkers.length).toBe(2) // Source and Destination
  })

  it('displays the flow table component', () => {
    render(<Dashboard />)
    expect(screen.getByTestId('flow-table-mock')).toBeInTheDocument()
  })

  it('has a header with app title', () => {
    render(<Dashboard />)
    expect(screen.getByText(/nfchat/i)).toBeInTheDocument()
  })

  it('shows loading state when data is loading', () => {
    render(<Dashboard loading={true} />)
    expect(screen.getByTestId('dashboard-loading')).toBeInTheDocument()
  })

  it('shows chat toggle button', () => {
    render(<Dashboard />)
    expect(screen.getByRole('button', { name: /chat/i })).toBeInTheDocument()
  })

  describe('performance', () => {
    it('passes stable onRowClick callback to FlowTable', () => {
      render(<Dashboard />)

      const firstCallback = flowTableProps?.onRowClick

      // Trigger a re-render by updating unrelated store state
      act(() => {
        useStore.setState({ totalFlowCount: 100 })
      })

      // The callback should be stable (same reference)
      expect(flowTableProps?.onRowClick).toBe(firstCallback)
    })

    it('computes selectedIndex correctly when selectedFlow matches a flow', () => {
      const mockFlows = [
        { FLOW_START_MILLISECONDS: 1000, IPV4_SRC_ADDR: '192.168.1.1' },
        { FLOW_START_MILLISECONDS: 2000, IPV4_SRC_ADDR: '192.168.1.2' },
        { FLOW_START_MILLISECONDS: 3000, IPV4_SRC_ADDR: '192.168.1.3' },
      ]

      useStore.setState({
        flows: mockFlows,
        selectedFlow: mockFlows[1],
      })

      render(<Dashboard />)

      expect(flowTableProps?.selectedIndex).toBe(1)
    })

    it('passes undefined selectedIndex when no flow is selected', () => {
      const mockFlows = [
        { FLOW_START_MILLISECONDS: 1000, IPV4_SRC_ADDR: '192.168.1.1' },
      ]

      useStore.setState({
        flows: mockFlows,
        selectedFlow: null,
      })

      render(<Dashboard />)

      expect(flowTableProps?.selectedIndex).toBeUndefined()
    })
  })
})
