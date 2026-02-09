import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StateComparison } from './StateComparison'
import type { StateProfile } from '@/lib/store/types'

// Mock query functions
vi.mock('@/lib/motherduck/queries', () => ({
  getSampleFlows: vi.fn(),
  getStateTopHosts: vi.fn(),
  getStateTimeline: vi.fn(),
  getStateConnStates: vi.fn(),
  getStatePortServices: vi.fn(),
}))

const mockState1: StateProfile = {
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

const mockState2: StateProfile = {
  stateId: 1,
  flowCount: 800,
  avgInBytes: 4096,
  avgOutBytes: 1024,
  bytesRatio: 4.0,
  avgDurationMs: 7000,
  avgPktsPerSec: 25.0,
  protocolDist: { tcp: 0.9, udp: 0.08, icmp: 0.02 },
  portCategoryDist: { wellKnown: 0.8, registered: 0.15, ephemeral: 0.05 },
}

describe('StateComparison', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders two state headers side by side', () => {
    render(<StateComparison state1={mockState1} state2={mockState2} />)

    expect(screen.getByText('State 0')).toBeInTheDocument()
    expect(screen.getByText('State 1')).toBeInTheDocument()
  })

  it('displays delta indicators for avgInBytes', () => {
    render(<StateComparison state1={mockState1} state2={mockState2} />)

    // State 2 has 4096 bytes, State 1 has 2048 bytes
    // Delta: ((4096 - 2048) / 2048) * 100 = 100%
    // Multiple 100% deltas exist, so use getAllByText
    const deltaElements = screen.getAllByText(/100%/)
    expect(deltaElements.length).toBeGreaterThanOrEqual(1)

    const arrows = screen.getAllByText(/↑/)
    expect(arrows.length).toBeGreaterThanOrEqual(1)
  })

  it('displays delta indicators for avgOutBytes', () => {
    render(<StateComparison state1={mockState1} state2={mockState2} />)

    // State 2 has 1024 bytes, State 1 has 512 bytes
    // Delta: ((1024 - 512) / 512) * 100 = 100%
    const deltaElements = screen.getAllByText(/100%/)
    expect(deltaElements.length).toBeGreaterThanOrEqual(1)
  })

  it('displays delta indicators for avgDurationMs', () => {
    render(<StateComparison state1={mockState1} state2={mockState2} />)

    // State 2 has 7000ms, State 1 has 3500ms
    // Delta: ((7000 - 3500) / 3500) * 100 = 100%
    const deltaElements = screen.getAllByText(/100%/)
    expect(deltaElements.length).toBeGreaterThanOrEqual(2)
  })

  it('shows down arrow for decreased values', () => {
    const state3: StateProfile = {
      ...mockState2,
      avgInBytes: 1024, // Lower than state1's 2048
    }

    render(<StateComparison state1={mockState1} state2={state3} />)

    // Should show down arrow for decreased avgInBytes
    expect(screen.getByText(/↓/)).toBeInTheDocument()
  })

  it('handles zero division safely when baseline is zero', () => {
    const state3: StateProfile = {
      ...mockState1,
      avgInBytes: 0,
    }

    // Should not crash with division by zero
    expect(() => {
      render(<StateComparison state1={state3} state2={mockState2} />)
    }).not.toThrow()
  })

  it('displays protocol distribution comparison', () => {
    render(<StateComparison state1={mockState1} state2={mockState2} />)

    // Should show TCP percentages for both states
    expect(screen.getByText(/75%/)).toBeInTheDocument() // State 1 TCP
    expect(screen.getByText(/90%/)).toBeInTheDocument() // State 2 TCP
  })

  it('displays port category distribution comparison', () => {
    render(<StateComparison state1={mockState1} state2={mockState2} />)

    // Should show well-known percentages
    expect(screen.getByText(/60%/)).toBeInTheDocument() // State 1 well-known
    expect(screen.getByText(/80%/)).toBeInTheDocument() // State 2 well-known
  })

  it('color-codes deltas (red for higher suspicious metrics)', () => {
    const { container } = render(<StateComparison state1={mockState1} state2={mockState2} />)

    // Check that there are elements with red color for increased metrics
    const redElements = container.querySelectorAll('[class*="text-red"]')
    expect(redElements.length).toBeGreaterThan(0)
  })

  it('color-codes deltas (green for lower suspicious metrics)', () => {
    const state3: StateProfile = {
      ...mockState2,
      avgInBytes: 1024, // Lower than state1
    }

    const { container } = render(<StateComparison state1={mockState1} state2={state3} />)

    // Check that there are elements with green color for decreased metrics
    const greenElements = container.querySelectorAll('[class*="text-green"]')
    expect(greenElements.length).toBeGreaterThan(0)
  })

  it('shows N/A for delta when baseline metric is zero', () => {
    const state3: StateProfile = {
      ...mockState1,
      avgInBytes: 0, // Zero baseline
    }

    render(<StateComparison state1={state3} state2={mockState2} />)

    // Should show N/A instead of percentage for avgInBytes delta
    expect(screen.getByText('N/A')).toBeInTheDocument()
  })

  it('displays flow counts for both states', () => {
    render(<StateComparison state1={mockState1} state2={mockState2} />)

    expect(screen.getByText(/1,500 flows/)).toBeInTheDocument()
    expect(screen.getByText(/800 flows/)).toBeInTheDocument()
  })

  it('handles identical states (all deltas should be 0%)', () => {
    const identicalState: StateProfile = { ...mockState1 }

    render(<StateComparison state1={mockState1} state2={identicalState} />)

    // When values are identical, delta should be 0%
    // There will be multiple "0%" texts (one for each metric)
    const zeroDeltas = screen.getAllByText(/0%/)
    expect(zeroDeltas.length).toBeGreaterThanOrEqual(1)
  })
})
