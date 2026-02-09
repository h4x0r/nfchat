import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StateExplorer } from './index'
import { useStore } from '@/lib/store'
import { useStateDetails } from '@/hooks/useStateDetails'
import type { StateProfile } from '@/lib/store/types'

// Mock query functions (only those still used directly by index.tsx)
vi.mock('@/lib/motherduck/queries', () => ({
  updateStateTactic: vi.fn().mockResolvedValue(undefined),
  getStateTransitions: vi.fn().mockResolvedValue([]),
  getStateTemporalDist: vi.fn().mockResolvedValue([]),
}))

// Mock discovery service
vi.mock('@/lib/hmm/discovery-service', () => ({
  discoverStates: vi.fn().mockResolvedValue({
    profiles: [],
    converged: true,
    iterations: 10,
    logLikelihood: -100,
  }),
}))

// Mock useStateDetails for StateCard
vi.mock('@/hooks/useStateDetails', () => ({
  useStateDetails: vi.fn().mockReturnValue({
    topHosts: { srcHosts: [], dstHosts: [] },
    timeline: [],
    connStates: [],
    portServices: { ports: [], services: [] },
    sampleFlows: [],
    loading: false,
    error: null,
  }),
}))

const mockStates: StateProfile[] = [
  {
    stateId: 0,
    flowCount: 500,
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
    flowCount: 300,
    avgInBytes: 200,
    avgOutBytes: 100,
    bytesRatio: 2.0,
    avgDurationMs: 500,
    avgPktsPerSec: 20,
    protocolDist: { tcp: 0.6, udp: 0.3, icmp: 0.1 },
    portCategoryDist: { wellKnown: 0.7, registered: 0.2, ephemeral: 0.1 },
  },
]

describe('StateExplorer', () => {
  beforeEach(() => {
    useStore.setState({
      hmmStates: [],
      hmmTraining: false,
      hmmProgress: 0,
      hmmError: null,
      tacticAssignments: {},
      hmmConverged: null,
      hmmIterations: null,
      hmmLogLikelihood: null,
    })
  })

  it('renders empty state with discover prompt', () => {
    render(<StateExplorer />)
    expect(screen.getByText(/no states discovered/i)).toBeInTheDocument()
  })

  it('renders discovery controls', () => {
    render(<StateExplorer />)
    expect(screen.getByRole('button', { name: /discover states/i })).toBeInTheDocument()
  })

  it('shows training progress when hmmTraining is true', () => {
    useStore.setState({ hmmTraining: true, hmmProgress: 45 })
    render(<StateExplorer />)
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('renders state cards when states are discovered', () => {
    useStore.setState({ hmmStates: mockStates })
    render(<StateExplorer />)
    expect(screen.getByText('State 0')).toBeInTheDocument()
    expect(screen.getByText('State 1')).toBeInTheDocument()
    expect(screen.getByText(/500 flows/)).toBeInTheDocument()
    expect(screen.getByText(/300 flows/)).toBeInTheDocument()
  })

  it('shows error message when hmmError is set', () => {
    useStore.setState({ hmmError: 'Insufficient data for training' })
    render(<StateExplorer />)
    expect(screen.getByText(/insufficient data/i)).toBeInTheDocument()
  })

  it('renders save button when states are discovered', () => {
    useStore.setState({ hmmStates: mockStates })
    render(<StateExplorer />)
    expect(screen.getByRole('button', { name: /save all labels/i })).toBeInTheDocument()
  })

  it('renders StateSummaryBar segments when states are discovered', () => {
    useStore.setState({ hmmStates: mockStates })
    render(<StateExplorer />)
    expect(screen.getByTestId('segment-0')).toBeInTheDocument()
    expect(screen.getByTestId('segment-1')).toBeInTheDocument()
    expect(screen.getByText(/800 total flows across 2 states/)).toBeInTheDocument()
  })

  it('passes convergence info to DiscoveryControls', () => {
    useStore.setState({
      hmmStates: mockStates,
      hmmConverged: true,
      hmmIterations: 47,
    })
    render(<StateExplorer />)
    expect(screen.getByText(/Converged after 47 iterations/)).toBeInTheDocument()
  })

  it('updates tactic assignment in store when tactic is changed', async () => {
    const user = userEvent.setup()
    useStore.setState({ hmmStates: mockStates })
    render(<StateExplorer />)

    // Find all comboboxes, then select the one that has the 'Exfiltration' option (a tactic selector)
    const allSelects = screen.getAllByRole('combobox')
    const tacticSelect = allSelects.find(
      (el) => el.querySelector('option[value="Exfiltration"]') !== null
    )!
    await user.selectOptions(tacticSelect, 'Exfiltration')

    expect(useStore.getState().tacticAssignments[0]).toBe('Exfiltration')
  })

  describe('Export JSON', () => {
    let createObjectURLSpy: ReturnType<typeof vi.fn>
    let revokeObjectURLSpy: ReturnType<typeof vi.fn>

    beforeEach(() => {
      createObjectURLSpy = vi.fn().mockReturnValue('blob:mock-url')
      revokeObjectURLSpy = vi.fn()
      globalThis.URL.createObjectURL = createObjectURLSpy as unknown as typeof URL.createObjectURL
      globalThis.URL.revokeObjectURL = revokeObjectURLSpy as unknown as typeof URL.revokeObjectURL
    })

    it('exports state profiles as JSON when Export button is clicked', async () => {
      const user = userEvent.setup()
      useStore.setState({
        hmmStates: mockStates,
        tacticAssignments: { 0: 'Exfiltration' },
      })

      const clickSpy = vi.fn()
      const mockAnchor = {
        href: '',
        download: '',
        click: clickSpy,
      } as unknown as HTMLAnchorElement

      render(<StateExplorer />)

      // Mock createElement AFTER render so it only intercepts the export's 'a' element
      const origCreateElement = document.createElement.bind(document)
      vi.spyOn(document, 'createElement').mockImplementation((tag: string, options?: ElementCreationOptions) => {
        if (tag === 'a') return mockAnchor as unknown as HTMLAnchorElement
        return origCreateElement(tag, options)
      })

      const exportBtn = screen.getByRole('button', { name: /export json/i })
      await user.click(exportBtn)

      // Verify Blob was created with correct content
      expect(createObjectURLSpy).toHaveBeenCalledOnce()
      const blob: Blob = createObjectURLSpy.mock.calls[0][0]
      expect(blob).toBeInstanceOf(Blob)
      expect(blob.type).toBe('application/json')

      // Read blob content via FileReader (jsdom doesn't support Blob.text())
      const text = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.readAsText(blob)
      })
      const parsed = JSON.parse(text)
      expect(parsed).toHaveLength(2)
      expect(parsed[0].stateId).toBe(0)
      expect(parsed[0].tactic).toBe('Exfiltration')
      expect(parsed[1].stateId).toBe(1)
      expect(parsed[1].tactic).toBe('Unassigned')

      // Verify download was triggered
      expect(mockAnchor.download).toMatch(/^state-profiles-\d+\.json$/)
      expect(clickSpy).toHaveBeenCalledOnce()
      expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url')

      vi.restoreAllMocks()
    })
  })

  it('hides empty state during training', () => {
    useStore.setState({ hmmTraining: true, hmmProgress: 50 })
    render(<StateExplorer />)

    // Should show progress but NOT the "No states discovered" message
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
    expect(screen.queryByText(/no states discovered/i)).not.toBeInTheDocument()
  })

  it('renders Export JSON button when states exist', () => {
    useStore.setState({ hmmStates: mockStates })
    render(<StateExplorer />)

    expect(screen.getByRole('button', { name: /export json/i })).toBeInTheDocument()
  })

  it('shows convergence not converged message', () => {
    useStore.setState({
      hmmStates: mockStates,
      hmmConverged: false,
      hmmIterations: 100,
    })
    render(<StateExplorer />)

    // The message is "Did not converge (100 iterations)" not "after"
    expect(screen.getByText(/Did not converge \(100 iterations\)/)).toBeInTheDocument()
  })

  it('handles multiple states with different flow counts', () => {
    const multipleStates = [
      { ...mockStates[0], stateId: 0, flowCount: 100 },
      { ...mockStates[1], stateId: 1, flowCount: 2000 },
      { ...mockStates[0], stateId: 2, flowCount: 350 },
    ]
    useStore.setState({ hmmStates: multipleStates })
    render(<StateExplorer />)

    expect(screen.getByText(/100 flows/)).toBeInTheDocument()
    expect(screen.getByText(/2,000 flows/)).toBeInTheDocument()
    expect(screen.getByText(/350 flows/)).toBeInTheDocument()
    expect(screen.getByText(/2,450 total flows across 3 states/)).toBeInTheDocument()
  })

  describe('Keyboard Navigation', () => {
    // Helper: find which stateId has expanded=true by checking useStateDetails calls
    function getExpandedStateId(): number | null {
      const mockFn = vi.mocked(useStateDetails)
      // Find the most recent call where expanded=true
      for (let i = mockFn.mock.calls.length - 1; i >= 0; i--) {
        if (mockFn.mock.calls[i][1] === true) {
          return mockFn.mock.calls[i][0] as number
        }
      }
      return null
    }

    it('expands first state on ArrowRight', () => {
      useStore.setState({ hmmStates: mockStates })
      render(<StateExplorer />)

      vi.mocked(useStateDetails).mockClear()
      fireEvent.keyDown(document, { key: 'ArrowRight' })
      expect(getExpandedStateId()).toBe(0)
    })

    it('expands next state on consecutive ArrowRight', () => {
      useStore.setState({ hmmStates: mockStates })
      render(<StateExplorer />)

      fireEvent.keyDown(document, { key: 'ArrowRight' })
      fireEvent.keyDown(document, { key: 'ArrowRight' })
      expect(getExpandedStateId()).toBe(1)
    })

    it('wraps to first state when ArrowRight at end', () => {
      useStore.setState({ hmmStates: mockStates })
      render(<StateExplorer />)

      fireEvent.keyDown(document, { key: 'ArrowRight' })
      fireEvent.keyDown(document, { key: 'ArrowRight' })
      fireEvent.keyDown(document, { key: 'ArrowRight' })
      expect(getExpandedStateId()).toBe(0)
    })

    it('expands last state on ArrowLeft when none expanded', () => {
      useStore.setState({ hmmStates: mockStates })
      render(<StateExplorer />)

      vi.mocked(useStateDetails).mockClear()
      fireEvent.keyDown(document, { key: 'ArrowLeft' })
      expect(getExpandedStateId()).toBe(1)
    })

    it('expands previous state on ArrowLeft', () => {
      useStore.setState({ hmmStates: mockStates })
      render(<StateExplorer />)

      // Navigate to state 1 first
      fireEvent.keyDown(document, { key: 'ArrowRight' })
      fireEvent.keyDown(document, { key: 'ArrowRight' })
      // Then go left
      fireEvent.keyDown(document, { key: 'ArrowLeft' })
      expect(getExpandedStateId()).toBe(0)
    })

    it('collapses expanded state on Escape', () => {
      useStore.setState({ hmmStates: mockStates })
      render(<StateExplorer />)

      fireEvent.keyDown(document, { key: 'ArrowRight' })
      expect(getExpandedStateId()).toBe(0)

      vi.mocked(useStateDetails).mockClear()
      fireEvent.keyDown(document, { key: 'Escape' })
      // After escape, no state should have expanded=true
      expect(getExpandedStateId()).toBeNull()
    })

    it('does not respond to keys when no states exist', () => {
      useStore.setState({ hmmStates: [] })
      render(<StateExplorer />)

      vi.mocked(useStateDetails).mockClear()
      fireEvent.keyDown(document, { key: 'ArrowRight' })
      // useStateDetails should not have been called since there are no cards
      expect(vi.mocked(useStateDetails).mock.calls.length).toBe(0)
    })
  })
})
