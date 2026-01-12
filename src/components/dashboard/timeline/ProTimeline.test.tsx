import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ProTimeline } from './ProTimeline'

describe('ProTimeline', () => {
  const mockData = [
    { time: 0, attack: 'Benign', count: 10 },
    { time: 1000, attack: 'Benign', count: 15 },
    { time: 2000, attack: 'DDoS', count: 5 },
    { time: 3000, attack: 'Benign', count: 20 },
  ]

  it('renders without crashing', () => {
    render(<ProTimeline data={mockData} />)
    expect(screen.getByRole('button', { name: /play/i })).toBeInTheDocument()
  })

  it('displays timecode', () => {
    render(<ProTimeline data={mockData} />)
    // Should show 00:00:00 initially
    expect(screen.getByText('00:00:00')).toBeInTheDocument()
  })

  it('renders the time ruler', () => {
    const { container } = render(<ProTimeline data={mockData} />)
    // TimeRuler component should be present (may have 0 ticks in test env due to 0 width)
    const ruler = container.querySelector('.bg-\\[\\#1a1a1a\\]')
    expect(ruler).toBeInTheDocument()
  })

  it('renders the playhead', () => {
    const { container } = render(<ProTimeline data={mockData} />)
    expect(container.querySelector('[data-playhead]')).toBeInTheDocument()
  })

  it('shows loading state', () => {
    render(<ProTimeline data={[]} loading={true} />)
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('calls onTimeChange when playhead is moved', () => {
    const onTimeChange = vi.fn()
    const { container } = render(
      <ProTimeline data={mockData} onTimeChange={onTimeChange} />
    )

    // Click on the track area to seek
    const track = container.querySelector('[data-timeline-track]')
    if (track) {
      fireEvent.click(track, { clientX: 100 })
      expect(onTimeChange).toHaveBeenCalled()
    }
  })

  it('applies Premiere Pro dark theme', () => {
    const { container } = render(<ProTimeline data={mockData} />)
    expect(container.firstChild).toHaveClass('bg-[#0a0a0a]')
  })
})
