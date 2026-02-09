import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StateCard } from './StateCard'
import { useStore } from '@/lib/store'
import type { StateProfile } from '@/lib/store/types'

// Mock useStateDetails hook
const mockUseStateDetails = vi.fn()

vi.mock('@/hooks/useStateDetails', () => ({
  useStateDetails: (...args: unknown[]) => mockUseStateDetails(...args),
}))

const mockState: StateProfile = {
  stateId: 0,
  flowCount: 1500,
  avgInBytes: 2048,
  avgOutBytes: 512,
  bytesRatio: 4.0,
  avgDurationMs: 3500,
  avgPktsPerSec: 12.5,
  protocolDist: { tcp: 0.75, udp: 0.2, icmp: 0.05 },
  portCategoryDist: { wellKnown: 0.6, registered: 0.3, ephemeral: 0.1 },
}

const defaultDetails = {
  topHosts: { srcHosts: [], dstHosts: [] },
  timeline: [],
  connStates: [],
  portServices: { ports: [], services: [] },
  sampleFlows: [],
  loading: false,
  error: null,
}

describe('StateCard', () => {
  beforeEach(() => {
    mockUseStateDetails.mockReset()
    mockUseStateDetails.mockReturnValue(defaultDetails)
  })

  it('renders state header with ID and flow count', () => {
    render(
      <StateCard
        state={mockState}
        onTacticAssign={vi.fn()}
        expanded={false}
        onToggleExpand={vi.fn()}
      />
    )
    expect(screen.getByText(/State 0/)).toBeInTheDocument()
    expect(screen.getByText(/1,500 flows/)).toBeInTheDocument()
  })

  it('renders traffic profile metrics', () => {
    render(
      <StateCard
        state={mockState}
        onTacticAssign={vi.fn()}
        expanded={false}
        onToggleExpand={vi.fn()}
      />
    )
    expect(screen.getByText(/avg in/i)).toBeInTheDocument()
    expect(screen.getByText(/avg out/i)).toBeInTheDocument()
    // Use getAllByText since "Duration" appears in both metric label and narrative
    const durationElements = screen.getAllByText(/duration/i)
    expect(durationElements.length).toBeGreaterThanOrEqual(1)
  })

  it('renders protocol distribution bars', () => {
    render(
      <StateCard
        state={mockState}
        onTacticAssign={vi.fn()}
        expanded={false}
        onToggleExpand={vi.fn()}
      />
    )
    expect(screen.getByText('TCP')).toBeInTheDocument()
    expect(screen.getByText('UDP')).toBeInTheDocument()
    expect(screen.getByText(/75%/)).toBeInTheDocument()
  })

  it('renders tactic selector showing unassigned when no tactic assigned', () => {
    render(
      <StateCard
        state={mockState}
        onTacticAssign={vi.fn()}
        expanded={false}
        onToggleExpand={vi.fn()}
      />
    )
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('calls onTacticAssign when tactic is changed', async () => {
    const user = userEvent.setup()
    const onTacticAssign = vi.fn()
    render(
      <StateCard
        state={mockState}
        onTacticAssign={onTacticAssign}
        expanded={false}
        onToggleExpand={vi.fn()}
      />
    )

    await user.selectOptions(screen.getByRole('combobox'), 'Exfiltration')
    expect(onTacticAssign).toHaveBeenCalledWith(0, 'Exfiltration')
  })

  it('loads detail data when expanded', async () => {
    mockUseStateDetails.mockReturnValue({
      ...defaultDetails,
      topHosts: {
        srcHosts: [{ ip: '10.0.0.1', count: 100 }],
        dstHosts: [{ ip: '192.168.1.1', count: 80 }],
      },
      connStates: [{ state: 'SF', count: 500 }],
      timeline: [{ bucket: 0, count: 10 }],
    })

    render(
      <StateCard
        state={mockState}
        onTacticAssign={vi.fn()}
        expanded={true}
        onToggleExpand={vi.fn()}
      />
    )

    expect(mockUseStateDetails).toHaveBeenCalledWith(0, true)
    expect(screen.getByText('10.0.0.1')).toBeInTheDocument()
  })

  it('calls onToggleExpand when expand button is clicked', async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()
    render(
      <StateCard
        state={mockState}
        onTacticAssign={vi.fn()}
        expanded={false}
        onToggleExpand={onToggle}
      />
    )

    await user.click(screen.getByRole('button', { name: /sample flows/i }))
    expect(onToggle).toHaveBeenCalled()
  })

  it('renders View Flows button that navigates to dashboard with state filter', async () => {
    const user = userEvent.setup()
    useStore.setState({ activeView: 'stateExplorer', selectedHmmState: null })

    render(
      <StateCard
        state={mockState}
        onTacticAssign={vi.fn()}
        expanded={false}
        onToggleExpand={vi.fn()}
      />
    )

    const viewFlowsBtn = screen.getByRole('button', { name: /view flows/i })
    expect(viewFlowsBtn).toBeInTheDocument()

    await user.click(viewFlowsBtn)

    expect(useStore.getState().selectedHmmState).toBe(0)
    expect(useStore.getState().activeView).toBe('dashboard')
  })

  it('does not show anomaly badge when anomalyScore is undefined', () => {
    const stateWithoutAnomaly = { ...mockState, anomalyScore: undefined }
    render(
      <StateCard
        state={stateWithoutAnomaly}
        onTacticAssign={vi.fn()}
        expanded={false}
        onToggleExpand={vi.fn()}
      />
    )

    expect(screen.queryByText(/⚠/)).not.toBeInTheDocument()
  })

  it('shows anomaly badge with high score (>=80)', () => {
    const stateWithHighAnomaly = { ...mockState, anomalyScore: 85, anomalyFactors: ['bytes_ratio'] }
    render(
      <StateCard
        state={stateWithHighAnomaly}
        onTacticAssign={vi.fn()}
        expanded={false}
        onToggleExpand={vi.fn()}
      />
    )

    const badge = screen.getByText(/⚠ 85/)
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveClass('bg-red-500/20', 'text-red-700')
  })

  it('shows anomaly badge with medium score (50-79)', () => {
    const stateWithMediumAnomaly = { ...mockState, anomalyScore: 60 }
    render(
      <StateCard
        state={stateWithMediumAnomaly}
        onTacticAssign={vi.fn()}
        expanded={false}
        onToggleExpand={vi.fn()}
      />
    )

    const badge = screen.getByText(/⚠ 60/)
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveClass('bg-yellow-500/20', 'text-yellow-700')
  })

  it('shows anomaly badge with low score (1-49)', () => {
    const stateWithLowAnomaly = { ...mockState, anomalyScore: 30 }
    render(
      <StateCard
        state={stateWithLowAnomaly}
        onTacticAssign={vi.fn()}
        expanded={false}
        onToggleExpand={vi.fn()}
      />
    )

    const badge = screen.getByText(/⚠ 30/)
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveClass('bg-green-500/20', 'text-green-700')
  })

  it('does not show anomaly badge when anomalyScore is 0', () => {
    const stateWithZeroAnomaly = { ...mockState, anomalyScore: 0 }
    render(
      <StateCard
        state={stateWithZeroAnomaly}
        onTacticAssign={vi.fn()}
        expanded={false}
        onToggleExpand={vi.fn()}
      />
    )

    expect(screen.queryByText(/⚠/)).not.toBeInTheDocument()
  })

  it('compare button hidden when onToggleCompare not provided', () => {
    render(
      <StateCard
        state={mockState}
        onTacticAssign={vi.fn()}
        expanded={false}
        onToggleExpand={vi.fn()}
      />
    )

    expect(screen.queryByText(/compare/i)).not.toBeInTheDocument()
  })

  it('compare button shows checkmark when selectedForComparison', () => {
    render(
      <StateCard
        state={mockState}
        onTacticAssign={vi.fn()}
        expanded={false}
        onToggleExpand={vi.fn()}
        selectedForComparison={true}
        onToggleCompare={vi.fn()}
      />
    )

    expect(screen.getByText(/✓ compare/i)).toBeInTheDocument()
  })

  it('ICMP bar hidden when value < 1%', () => {
    const stateWithLowIcmp = {
      ...mockState,
      protocolDist: { tcp: 0.80, udp: 0.195, icmp: 0.005 },
    }
    render(
      <StateCard
        state={stateWithLowIcmp}
        onTacticAssign={vi.fn()}
        expanded={false}
        onToggleExpand={vi.fn()}
      />
    )

    expect(screen.getByText('TCP')).toBeInTheDocument()
    expect(screen.getByText('UDP')).toBeInTheDocument()
    expect(screen.queryByText('ICMP')).not.toBeInTheDocument()
  })

  it('renders narrative text', () => {
    render(
      <StateCard
        state={mockState}
        onTacticAssign={vi.fn()}
        expanded={false}
        onToggleExpand={vi.fn()}
      />
    )

    // The narrative should be present - check for any of the keywords it typically contains
    // For mockState: avgInBytes=2048, avgOutBytes=512, avgDurationMs=3500
    // Expected narrative: "medium-duration medium-volume predominantly TCP flows inbound-heavy flows targeting well-known ports."
    const narrative = screen.getByText(/medium-duration/i)
    expect(narrative).toBeInTheDocument()
    expect(narrative.tagName).toBe('P')
    expect(narrative.className).toContain('italic')
  })
})
