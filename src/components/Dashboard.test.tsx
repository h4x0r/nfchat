import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Dashboard } from './Dashboard'

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
  FlowTable: () => <div data-testid="flow-table-mock">FlowTable</div>,
}))

describe('Dashboard', () => {
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
})
