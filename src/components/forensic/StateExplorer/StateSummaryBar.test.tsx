import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StateSummaryBar } from './StateSummaryBar'
import type { StateProfile } from '@/lib/store/types'

const mockStates: StateProfile[] = [
  {
    stateId: 0,
    flowCount: 600,
    avgInBytes: 1024,
    avgOutBytes: 512,
    bytesRatio: 2.0,
    avgDurationMs: 2000,
    avgPktsPerSec: 5,
    protocolDist: { tcp: 0.8, udp: 0.15, icmp: 0.05 },
    portCategoryDist: { wellKnown: 0.5, registered: 0.3, ephemeral: 0.2 },
  },
  {
    stateId: 1,
    flowCount: 400,
    avgInBytes: 200,
    avgOutBytes: 100,
    bytesRatio: 2.0,
    avgDurationMs: 500,
    avgPktsPerSec: 20,
    protocolDist: { tcp: 0.6, udp: 0.3, icmp: 0.1 },
    portCategoryDist: { wellKnown: 0.7, registered: 0.2, ephemeral: 0.1 },
  },
]

describe('StateSummaryBar', () => {
  it('renders segments for each state', () => {
    render(<StateSummaryBar states={mockStates} tacticAssignments={{}} />)
    const segments = screen.getAllByTestId(/segment-/)
    expect(segments).toHaveLength(2)
  })

  it('renders segments with proportional widths', () => {
    render(<StateSummaryBar states={mockStates} tacticAssignments={{}} />)
    const seg0 = screen.getByTestId('segment-0')
    const seg1 = screen.getByTestId('segment-1')
    // 600/1000 = 60%, 400/1000 = 40%
    expect(seg0.style.width).toBe('60%')
    expect(seg1.style.width).toBe('40%')
  })

  it('shows total flows and state count', () => {
    render(<StateSummaryBar states={mockStates} tacticAssignments={{}} />)
    expect(screen.getByText(/1,000 total flows/)).toBeInTheDocument()
    expect(screen.getByText(/2 states/)).toBeInTheDocument()
  })

  it('colors segments by assigned tactic', () => {
    render(
      <StateSummaryBar
        states={mockStates}
        tacticAssignments={{ 0: 'Exfiltration' }}
      />
    )
    const seg0 = screen.getByTestId('segment-0')
    // Exfiltration color #7c3aed -> rgb(124, 58, 237)
    expect(seg0.style.backgroundColor).toBe('rgb(124, 58, 237)')
  })

  it('colors segments as unassigned when no tactic assignment', () => {
    render(<StateSummaryBar states={mockStates} tacticAssignments={{}} />)
    const seg0 = screen.getByTestId('segment-0')
    // Unassigned color fallback #71717a -> rgb(113, 113, 122)
    expect(seg0.style.backgroundColor).toBe('rgb(113, 113, 122)')
  })

  it('calls onStateClick when a segment is clicked', async () => {
    const user = userEvent.setup()
    const onStateClick = vi.fn()
    render(
      <StateSummaryBar
        states={mockStates}
        tacticAssignments={{}}
        onStateClick={onStateClick}
      />
    )

    await user.click(screen.getByTestId('segment-1'))
    expect(onStateClick).toHaveBeenCalledWith(1)
  })

  it('renders nothing when states is empty', () => {
    const { container } = render(<StateSummaryBar states={[]} tacticAssignments={{}} />)
    expect(container.firstChild).toBeNull()
  })
})
