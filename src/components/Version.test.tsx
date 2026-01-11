import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Version } from './Version'

// Mock the build-time constants
vi.stubGlobal('__COMMIT_HASH__', 'e363920')
vi.stubGlobal('__BUILD_TIME__', '2026-01-11T11:16:00.000Z')

describe('Version', () => {
  beforeEach(() => {
    vi.stubGlobal('__COMMIT_HASH__', 'e363920')
    vi.stubGlobal('__BUILD_TIME__', '2026-01-11T11:16:00.000Z')
  })

  it('displays commit hash and formatted timestamp', () => {
    render(<Version />)

    // Should show format like "e363920 @ 2026-01-11 11:16Z"
    expect(screen.getByText(/e363920/)).toBeInTheDocument()
    expect(screen.getByText(/@/)).toBeInTheDocument()
    expect(screen.getByText(/2026-01-11/)).toBeInTheDocument()
  })

  it('displays in expected format', () => {
    render(<Version />)

    const versionText = screen.getByTestId('version').textContent
    expect(versionText).toMatch(/^[a-f0-9]{7} @ \d{4}-\d{2}-\d{2} \d{2}:\d{2}Z$/)
  })

  it('handles unknown commit hash gracefully', () => {
    vi.stubGlobal('__COMMIT_HASH__', 'unknown')

    render(<Version />)

    expect(screen.getByText(/unknown/)).toBeInTheDocument()
  })
})
