import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TimecodeDisplay } from './TimecodeDisplay'

describe('TimecodeDisplay', () => {
  it('renders current time in timecode format', () => {
    render(<TimecodeDisplay currentTime={61500} duration={120000} />)
    // 61.5 seconds = 01:01:15 at 30fps
    expect(screen.getByText('01:01:15')).toBeInTheDocument()
  })

  it('renders duration in timecode format', () => {
    render(<TimecodeDisplay currentTime={0} duration={120000} />)
    // 120 seconds = 02:00:00
    expect(screen.getByText('02:00:00')).toBeInTheDocument()
  })

  it('renders with custom fps', () => {
    render(<TimecodeDisplay currentTime={500} duration={1000} fps={24} />)
    // 0.5 seconds at 24fps = 12 frames
    expect(screen.getByText('00:00:12')).toBeInTheDocument()
  })

  it('displays in/out points when provided', () => {
    render(
      <TimecodeDisplay
        currentTime={5000}
        duration={60000}
        inPoint={10000}
        outPoint={30000}
      />
    )
    // In point: 10s = 00:10:00, Out point: 30s = 00:30:00
    expect(screen.getByText('00:10:00')).toBeInTheDocument()
    expect(screen.getByText('00:30:00')).toBeInTheDocument()
  })

  it('applies Premiere Pro styling', () => {
    const { container } = render(
      <TimecodeDisplay currentTime={0} duration={1000} />
    )
    // Should have dark background from Premiere color palette
    const display = container.firstChild as HTMLElement
    expect(display).toHaveClass('bg-[#1a1a1a]')
  })

  it('shows region duration when in/out points are set', () => {
    render(
      <TimecodeDisplay
        currentTime={15000}
        duration={60000}
        inPoint={10000}
        outPoint={30000}
      />
    )
    // Region duration: 30s - 10s = 20s = 00:20:00
    expect(screen.getByText('00:20:00')).toBeInTheDocument()
  })

  it('handles zero duration gracefully', () => {
    render(<TimecodeDisplay currentTime={0} duration={0} />)
    // Both current time and duration show 00:00:00
    const timecodes = screen.getAllByText('00:00:00')
    expect(timecodes).toHaveLength(2)
  })
})
