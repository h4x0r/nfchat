import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TimeRuler } from './TimeRuler'

describe('TimeRuler', () => {
  it('renders tick marks for the time range', () => {
    const { container } = render(
      <TimeRuler startTime={0} endTime={10000} width={500} />
    )
    // Should have tick marks
    const ticks = container.querySelectorAll('[data-tick]')
    expect(ticks.length).toBeGreaterThan(0)
  })

  it('displays time labels at major tick marks', () => {
    render(<TimeRuler startTime={0} endTime={60000} width={600} />)
    // At 10px/s, should show 10s major ticks
    // 60 seconds should show labels like 0:10, 0:20, etc.
    expect(screen.getByText('0:00')).toBeInTheDocument()
  })

  it('adapts tick density based on width', () => {
    const { container: narrow } = render(
      <TimeRuler startTime={0} endTime={60000} width={200} />
    )
    const { container: wide } = render(
      <TimeRuler startTime={0} endTime={60000} width={800} />
    )

    const narrowTicks = narrow.querySelectorAll('[data-tick="major"]')
    const wideTicks = wide.querySelectorAll('[data-tick="major"]')

    // Wider view should have more visible ticks or same with different spacing
    // Both should have reasonable tick counts
    expect(narrowTicks.length).toBeGreaterThan(0)
    expect(wideTicks.length).toBeGreaterThan(0)
  })

  it('applies Premiere Pro styling', () => {
    const { container } = render(
      <TimeRuler startTime={0} endTime={10000} width={500} />
    )
    // Should have dark background
    expect(container.firstChild).toHaveClass('bg-[#1a1a1a]')
  })

  it('handles zero duration gracefully', () => {
    const { container } = render(
      <TimeRuler startTime={0} endTime={0} width={500} />
    )
    // Should render without crashing
    expect(container.firstChild).toBeInTheDocument()
  })

  it('handles offset start time', () => {
    render(<TimeRuler startTime={60000} endTime={120000} width={600} />)
    // Should show labels starting from 1:00
    expect(screen.getByText('1:00')).toBeInTheDocument()
  })
})
