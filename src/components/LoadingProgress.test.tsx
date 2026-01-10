import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { LoadingProgress } from './LoadingProgress'
import type { ProgressEvent, LogEntry } from '@/lib/progress'

describe('LoadingProgress', () => {
  const mockProgress: ProgressEvent = {
    stage: 'downloading',
    percent: 45,
    message: 'Downloading: 45.0 MB / 100.0 MB',
    bytesLoaded: 45000000,
    bytesTotal: 100000000,
    timestamp: Date.now(),
  }

  it('renders stage label', () => {
    render(<LoadingProgress progress={mockProgress} logs={[]} />)
    expect(screen.getByText('Downloading')).toBeInTheDocument()
  })

  it('renders percentage', () => {
    render(<LoadingProgress progress={mockProgress} logs={[]} />)
    expect(screen.getByText('45%')).toBeInTheDocument()
  })

  it('renders progress message', () => {
    render(<LoadingProgress progress={mockProgress} logs={[]} />)
    expect(screen.getByText('Downloading: 45.0 MB / 100.0 MB')).toBeInTheDocument()
  })

  it('renders progress bar with correct width', () => {
    render(<LoadingProgress progress={mockProgress} logs={[]} />)
    const progressBar = screen.getByRole('progressbar')
    expect(progressBar).toHaveAttribute('aria-valuenow', '45')
  })

  it('renders log entries', () => {
    const logs: LogEntry[] = [
      { level: 'info', message: '[0.000s] Starting download', timestamp: Date.now() },
      { level: 'debug', message: '[0.100s] Chunk received', timestamp: Date.now() },
    ]
    render(<LoadingProgress progress={mockProgress} logs={logs} />)
    expect(screen.getByText('[0.000s] Starting download')).toBeInTheDocument()
    expect(screen.getByText('[0.100s] Chunk received')).toBeInTheDocument()
  })

  it('shows different colors for different stages', () => {
    const { rerender } = render(
      <LoadingProgress
        progress={{ ...mockProgress, stage: 'initializing' }}
        logs={[]}
      />
    )
    expect(screen.getByText('Initializing')).toBeInTheDocument()

    rerender(
      <LoadingProgress
        progress={{ ...mockProgress, stage: 'parsing' }}
        logs={[]}
      />
    )
    expect(screen.getByText('Parsing')).toBeInTheDocument()

    rerender(
      <LoadingProgress
        progress={{ ...mockProgress, stage: 'building' }}
        logs={[]}
      />
    )
    expect(screen.getByText('Building Dashboard')).toBeInTheDocument()

    rerender(
      <LoadingProgress
        progress={{ ...mockProgress, stage: 'complete' }}
        logs={[]}
      />
    )
    expect(screen.getByText('Complete')).toBeInTheDocument()
  })
})
