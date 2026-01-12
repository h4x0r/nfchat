import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PlaybackControls } from './PlaybackControls'

describe('PlaybackControls', () => {
  const defaultProps = {
    isPlaying: false,
    speed: 1 as const,
    onPlayPause: vi.fn(),
    onRewind: vi.fn(),
    onSpeedChange: vi.fn(),
  }

  it('renders play button when not playing', () => {
    render(<PlaybackControls {...defaultProps} />)
    expect(screen.getByRole('button', { name: /play/i })).toBeInTheDocument()
  })

  it('renders pause button when playing', () => {
    render(<PlaybackControls {...defaultProps} isPlaying={true} />)
    expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument()
  })

  it('calls onPlayPause when play/pause button is clicked', () => {
    const onPlayPause = vi.fn()
    render(<PlaybackControls {...defaultProps} onPlayPause={onPlayPause} />)
    fireEvent.click(screen.getByRole('button', { name: /play/i }))
    expect(onPlayPause).toHaveBeenCalled()
  })

  it('renders rewind button', () => {
    render(<PlaybackControls {...defaultProps} />)
    expect(screen.getByRole('button', { name: /rewind/i })).toBeInTheDocument()
  })

  it('calls onRewind when rewind button is clicked', () => {
    const onRewind = vi.fn()
    render(<PlaybackControls {...defaultProps} onRewind={onRewind} />)
    fireEvent.click(screen.getByRole('button', { name: /rewind/i }))
    expect(onRewind).toHaveBeenCalled()
  })

  it('displays current speed', () => {
    render(<PlaybackControls {...defaultProps} speed={2} />)
    expect(screen.getByText('2x')).toBeInTheDocument()
  })

  it('shows speed options when speed button is clicked', () => {
    render(<PlaybackControls {...defaultProps} />)
    fireEvent.click(screen.getByText('1x'))
    // Should show speed options
    expect(screen.getByText('0.25x')).toBeInTheDocument()
    expect(screen.getByText('4x')).toBeInTheDocument()
  })

  it('calls onSpeedChange when a speed option is selected', () => {
    const onSpeedChange = vi.fn()
    render(<PlaybackControls {...defaultProps} onSpeedChange={onSpeedChange} />)
    fireEvent.click(screen.getByText('1x'))
    fireEvent.click(screen.getByText('2x'))
    expect(onSpeedChange).toHaveBeenCalledWith(2)
  })

  it('disables buttons when disabled prop is true', () => {
    render(<PlaybackControls {...defaultProps} disabled={true} />)
    expect(screen.getByRole('button', { name: /play/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /rewind/i })).toBeDisabled()
  })

  it('applies Premiere Pro styling', () => {
    const { container } = render(<PlaybackControls {...defaultProps} />)
    expect(container.firstChild).toHaveClass('bg-[#1a1a1a]')
  })
})
