import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { StateCard } from './StateCard'
import type { StateProfile } from '@/lib/store/types'

// Mock query functions
const mockGetSampleFlows = vi.fn()
const mockGetStateTopHosts = vi.fn()
const mockGetStateTimeline = vi.fn()
const mockGetStateConnStates = vi.fn()
const mockGetStatePortServices = vi.fn()

vi.mock('@/lib/motherduck/queries', () => ({
  getSampleFlows: (...args: unknown[]) => mockGetSampleFlows(...args),
  getStateTopHosts: (...args: unknown[]) => mockGetStateTopHosts(...args),
  getStateTimeline: (...args: unknown[]) => mockGetStateTimeline(...args),
  getStateConnStates: (...args: unknown[]) => mockGetStateConnStates(...args),
  getStatePortServices: (...args: unknown[]) => mockGetStatePortServices(...args),
}))

const mockState: StateProfile = {
  stateId: 2,
  flowCount: 3000,
  avgInBytes: 4096,
  avgOutBytes: 1024,
  bytesRatio: 4.0,
  avgDurationMs: 7500,
  avgPktsPerSec: 15,
  protocolDist: { tcp: 0.9, udp: 0.08, icmp: 0.02 },
  portCategoryDist: { wellKnown: 0.7, registered: 0.2, ephemeral: 0.1 },
}

describe('StateCard expanded details', () => {
  beforeEach(() => {
    mockGetSampleFlows.mockReset()
    mockGetStateTopHosts.mockReset()
    mockGetStateTimeline.mockReset()
    mockGetStateConnStates.mockReset()
    mockGetStatePortServices.mockReset()

    // Default empty responses
    mockGetSampleFlows.mockResolvedValue([])
    mockGetStateTopHosts.mockResolvedValue({ srcHosts: [], dstHosts: [] })
    mockGetStateTimeline.mockResolvedValue([])
    mockGetStateConnStates.mockResolvedValue([])
    mockGetStatePortServices.mockResolvedValue({ ports: [], services: [] })
  })

  it('shows top source and destination hosts when expanded', async () => {
    mockGetStateTopHosts.mockResolvedValue({
      srcHosts: [
        { ip: '10.0.0.1', count: 500 },
        { ip: '10.0.0.2', count: 300 },
      ],
      dstHosts: [
        { ip: '192.168.1.1', count: 400 },
      ],
    })

    render(
      <StateCard
        state={mockState}
        onTacticAssign={vi.fn()}
        expanded={true}
        onToggleExpand={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Top Sources')).toBeInTheDocument()
    })
    expect(screen.getByText('10.0.0.1')).toBeInTheDocument()
    expect(screen.getByText('10.0.0.2')).toBeInTheDocument()
    expect(screen.getByText('Top Destinations')).toBeInTheDocument()
    expect(screen.getByText('192.168.1.1')).toBeInTheDocument()
  })

  it('shows connection states when expanded', async () => {
    mockGetStateConnStates.mockResolvedValue([
      { state: 'SF', count: 1200 },
      { state: 'S0', count: 300 },
      { state: 'REJ', count: 50 },
    ])

    render(
      <StateCard
        state={mockState}
        onTacticAssign={vi.fn()}
        expanded={true}
        onToggleExpand={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Connection States')).toBeInTheDocument()
    })
    expect(screen.getByText(/SF: 1200/)).toBeInTheDocument()
    expect(screen.getByText(/S0: 300/)).toBeInTheDocument()
    expect(screen.getByText(/REJ: 50/)).toBeInTheDocument()
  })

  it('shows timeline when expanded', async () => {
    mockGetStateTimeline.mockResolvedValue([
      { bucket: 1000000, count: 50 },
      { bucket: 2000000, count: 80 },
    ])

    render(
      <StateCard
        state={mockState}
        onTacticAssign={vi.fn()}
        expanded={true}
        onToggleExpand={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Timeline')).toBeInTheDocument()
    })
  })

  it('shows top ports and services when expanded', async () => {
    mockGetStatePortServices.mockResolvedValue({
      ports: [
        { port: 443, count: 900 },
        { port: 80, count: 400 },
      ],
      services: [
        { service: 'https', count: 850 },
        { service: 'http', count: 350 },
      ],
    })

    render(
      <StateCard
        state={mockState}
        onTacticAssign={vi.fn()}
        expanded={true}
        onToggleExpand={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Top Ports')).toBeInTheDocument()
    })
    expect(screen.getByText('443')).toBeInTheDocument()
    expect(screen.getByText('80')).toBeInTheDocument()
    expect(screen.getByText('Services')).toBeInTheDocument()
    expect(screen.getByText('https')).toBeInTheDocument()
    expect(screen.getByText('http')).toBeInTheDocument()
  })

  it('does not show expanded details when collapsed', () => {
    render(
      <StateCard
        state={mockState}
        onTacticAssign={vi.fn()}
        expanded={false}
        onToggleExpand={vi.fn()}
      />
    )

    expect(screen.queryByText('Top Sources')).not.toBeInTheDocument()
    expect(screen.queryByText('Connection States')).not.toBeInTheDocument()
    expect(screen.queryByText('Timeline')).not.toBeInTheDocument()
    expect(screen.queryByText('Top Ports')).not.toBeInTheDocument()
  })

  it('calls query functions with correct stateId when expanded', async () => {
    render(
      <StateCard
        state={mockState}
        onTacticAssign={vi.fn()}
        expanded={true}
        onToggleExpand={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(mockGetStateTopHosts).toHaveBeenCalledWith(2)
      expect(mockGetStateTimeline).toHaveBeenCalledWith(2)
      expect(mockGetStateConnStates).toHaveBeenCalledWith(2)
      expect(mockGetStatePortServices).toHaveBeenCalledWith(2)
      expect(mockGetSampleFlows).toHaveBeenCalledWith(2)
    })
  })

  it('shows flow preview loading state when expanded', () => {
    // getSampleFlows never resolves, so loading stays true
    mockGetSampleFlows.mockReturnValue(new Promise(() => {}))

    render(
      <StateCard
        state={mockState}
        onTacticAssign={vi.fn()}
        expanded={true}
        onToggleExpand={vi.fn()}
      />
    )

    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })
})
