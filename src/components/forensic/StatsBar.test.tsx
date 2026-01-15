import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StatsBar } from './StatsBar'
import { useStore } from '@/lib/store'

describe('StatsBar', () => {
  beforeEach(() => {
    useStore.setState({
      totalFlowCount: 1000,
      attackBreakdown: [
        { attack: 'DDoS', count: 500 },
        { attack: 'Exploits', count: 300 },
        { attack: 'Benign', count: 200 },
      ],
      topSrcIPs: [
        { ip: '192.168.1.100', value: 5000 },
        { ip: '10.0.0.50', value: 3000 },
      ],
      topDstIPs: [
        { ip: '8.8.8.8', value: 8000 },
        { ip: '1.1.1.1', value: 4000 },
      ],
    })
  })

  it('renders stats bar container', () => {
    render(<StatsBar onFilter={vi.fn()} />)
    expect(screen.getByTestId('stats-bar')).toBeInTheDocument()
  })

  it('displays flow count', () => {
    render(<StatsBar onFilter={vi.fn()} />)
    expect(screen.getByText('1.0K')).toBeInTheDocument()
    expect(screen.getByText('flows')).toBeInTheDocument()
  })

  it('shows attack popover trigger with top attack', () => {
    render(<StatsBar onFilter={vi.fn()} />)
    expect(screen.getByText(/DDoS/)).toBeInTheDocument()
  })

  it('shows top talkers popover trigger with top source IP', () => {
    render(<StatsBar onFilter={vi.fn()} />)
    expect(screen.getByText(/192\.168\.1\.100/)).toBeInTheDocument()
  })

  it('opens attack popover when clicked', async () => {
    const user = userEvent.setup()
    render(<StatsBar onFilter={vi.fn()} />)

    // Find the attack trigger button (contains DDoS)
    const attackButton = screen.getByText(/DDoS/).closest('button')
    expect(attackButton).toBeTruthy()

    await user.click(attackButton!)

    // Popover should show attack breakdown header
    expect(screen.getByText('Attack Breakdown')).toBeInTheDocument()
  })

  it('opens top talkers popover when clicked', async () => {
    const user = userEvent.setup()
    render(<StatsBar onFilter={vi.fn()} />)

    // Find the top talkers trigger button
    const topTalkersButton = screen.getByText(/192\.168\.1\.100/).closest('button')
    expect(topTalkersButton).toBeTruthy()

    await user.click(topTalkersButton!)

    // Popover should show top talkers header
    expect(screen.getByText('Top Talkers')).toBeInTheDocument()
  })

  it('calls onFilter when attack filter clicked', async () => {
    const user = userEvent.setup()
    const onFilter = vi.fn()
    render(<StatsBar onFilter={onFilter} />)

    // Open attack popover
    const attackButton = screen.getByText(/DDoS/).closest('button')
    await user.click(attackButton!)

    // Click first filter button
    const filterButtons = screen.getAllByText('Filter')
    await user.click(filterButtons[0])

    expect(onFilter).toHaveBeenCalledWith('Attack', 'DDoS')
  })

  it('formats large flow counts with M suffix', () => {
    useStore.setState({ totalFlowCount: 2500000 })
    render(<StatsBar onFilter={vi.fn()} />)
    expect(screen.getByText('2.5M')).toBeInTheDocument()
  })

  it('shows empty state when no attack data', () => {
    useStore.setState({ attackBreakdown: [] })
    render(<StatsBar onFilter={vi.fn()} />)
    expect(screen.getByText(/No attacks/i)).toBeInTheDocument()
  })

  describe('Hide Benign toggle', () => {
    beforeEach(() => {
      useStore.setState({ hideBenign: false })
    })

    it('renders Hide Benign button', () => {
      render(<StatsBar onFilter={vi.fn()} />)
      expect(screen.getByRole('button', { name: /hide benign/i })).toBeInTheDocument()
    })

    it('toggles hideBenign state when clicked', async () => {
      const user = userEvent.setup()
      render(<StatsBar onFilter={vi.fn()} />)

      const button = screen.getByRole('button', { name: /hide benign/i })
      await user.click(button)

      expect(useStore.getState().hideBenign).toBe(true)
    })

    it('shows "Showing Attacks" when hideBenign is true', () => {
      useStore.setState({ hideBenign: true })
      render(<StatsBar onFilter={vi.fn()} />)

      expect(screen.getByRole('button', { name: /showing attacks/i })).toBeInTheDocument()
    })

    it('toggles back to "Hide Benign" when clicked again', async () => {
      const user = userEvent.setup()
      useStore.setState({ hideBenign: true })
      render(<StatsBar onFilter={vi.fn()} />)

      const button = screen.getByRole('button', { name: /showing attacks/i })
      await user.click(button)

      expect(useStore.getState().hideBenign).toBe(false)
    })
  })
})
