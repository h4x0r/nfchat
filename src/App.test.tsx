import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import App from './App'
import * as useNetflowDataModule from '@/hooks/useNetflowData'
import type { ProgressStage } from '@/lib/progress'

// Mock the hooks
vi.mock('@/hooks/useNetflowData', () => ({
  useNetflowData: vi.fn(),
}))

// Mock motherduck functions
vi.mock('@/lib/motherduck', () => ({
  loadFileToMotherDuck: vi.fn(),
  getTimelineData: vi.fn().mockResolvedValue([]),
  getAttackDistribution: vi.fn().mockResolvedValue([]),
  getTopTalkers: vi.fn().mockResolvedValue([]),
  getFlows: vi.fn().mockResolvedValue([]),
  getFlowCount: vi.fn().mockResolvedValue(0),
}))

// Mock motherduck-auth to always return true (token is configured)
vi.mock('@/lib/motherduck-auth', () => ({
  hasMotherDuckToken: vi.fn().mockReturnValue(true),
}))

// Mock dashboard components that have complex dependencies
vi.mock('@/components/forensic/ForensicDashboard', () => ({
  ForensicDashboard: () => <div data-testid="forensic-dashboard">ForensicDashboard</div>,
}))

vi.mock('@/components/dashboard/timeline', () => ({
  ProTimeline: () => <div data-testid="timeline-mock">ProTimeline</div>,
}))

const mockDefaultHookReturn = () => ({
  loading: false,
  error: null,
  totalRows: 0,
  progress: { stage: 'initializing' as ProgressStage, percent: 0, message: '', timestamp: Date.now() },
  logs: [],
  refresh: vi.fn(),
})

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('initial state', () => {
    it('shows landing page with dropzone initially', () => {
      vi.mocked(useNetflowDataModule.useNetflowData).mockReturnValue(mockDefaultHookReturn())

      render(<App />)

      expect(screen.getByTestId('landing-page')).toBeInTheDocument()
      expect(screen.getByTestId('crt-dropzone')).toBeInTheDocument()
    })

    it('shows demo dataset link', () => {
      vi.mocked(useNetflowDataModule.useNetflowData).mockReturnValue(mockDefaultHookReturn())

      render(<App />)

      expect(screen.getByText(/demo dataset/i)).toBeInTheDocument()
    })

    it('shows Security Ronin logo', () => {
      vi.mocked(useNetflowDataModule.useNetflowData).mockReturnValue(mockDefaultHookReturn())

      render(<App />)

      const logo = screen.getByAltText(/security ronin/i)
      expect(logo).toBeInTheDocument()
    })

    it('shows headline text', () => {
      vi.mocked(useNetflowDataModule.useNetflowData).mockReturnValue(mockDefaultHookReturn())

      render(<App />)

      expect(screen.getByText(/interrogate your netflow data/i)).toBeInTheDocument()
    })

    it('shows MotherDuck footer', () => {
      vi.mocked(useNetflowDataModule.useNetflowData).mockReturnValue(mockDefaultHookReturn())

      render(<App />)

      expect(screen.getByText(/Security Ronin/i)).toBeInTheDocument()
    })
  })

  describe('demo data loading', () => {
    it('uses external CDN URL when demo clicked', async () => {
      let capturedUrl = ''

      vi.mocked(useNetflowDataModule.useNetflowData).mockImplementation((url) => {
        capturedUrl = url
        return mockDefaultHookReturn()
      })

      render(<App />)

      const demoLink = screen.getByText(/demo dataset/i)
      fireEvent.click(demoLink)

      await waitFor(() => {
        expect(capturedUrl).toMatch(/^https:\/\//)
        expect(capturedUrl).toContain('.parquet')
      })
    })

    it('uses correct demo parquet URL', async () => {
      let capturedUrl = ''

      vi.mocked(useNetflowDataModule.useNetflowData).mockImplementation((url) => {
        capturedUrl = url
        return mockDefaultHookReturn()
      })

      render(<App />)

      const demoLink = screen.getByText(/demo dataset/i)
      fireEvent.click(demoLink)

      await waitFor(() => {
        expect(capturedUrl).toContain('UWF-ZeekData24.parquet')
      })
    })

    it('shows CRT loading log when loading', async () => {
      vi.mocked(useNetflowDataModule.useNetflowData).mockImplementation((url) => {
        if (url) {
          return {
            loading: true,
            error: null,
            totalRows: 0,
            progress: { stage: 'downloading' as ProgressStage, percent: 50, message: 'Loading...', timestamp: Date.now() },
            logs: [
              { level: 'info' as const, message: 'Connecting to MotherDuck...', timestamp: Date.now() },
              { level: 'info' as const, message: 'Loading data...', timestamp: Date.now() },
            ],
            refresh: vi.fn(),
          }
        }
        return mockDefaultHookReturn()
      })

      render(<App />)

      const demoLink = screen.getByText(/demo dataset/i)
      fireEvent.click(demoLink)

      await waitFor(() => {
        // When loading, dropzone should disappear and CRT loading should be visible
        expect(screen.queryByTestId('crt-dropzone')).not.toBeInTheDocument()
        // Should show the Security Ronin footer (present in loading state)
        expect(screen.getByText(/Security Ronin/i)).toBeInTheDocument()
      })
    })

    it('hides dropzone after demo click', async () => {
      vi.mocked(useNetflowDataModule.useNetflowData).mockImplementation((url) => {
        if (url) {
          return {
            loading: true,
            error: null,
            totalRows: 0,
            progress: { stage: 'downloading' as ProgressStage, percent: 30, message: '', timestamp: Date.now() },
            logs: [],
            refresh: vi.fn(),
          }
        }
        return mockDefaultHookReturn()
      })

      render(<App />)

      const demoLink = screen.getByText(/demo dataset/i)
      fireEvent.click(demoLink)

      await waitFor(() => {
        expect(screen.queryByTestId('crt-dropzone')).not.toBeInTheDocument()
      })
    })
  })

  describe('loading state', () => {
    it('shows logo during loading', async () => {
      vi.mocked(useNetflowDataModule.useNetflowData).mockImplementation((url) => {
        if (url) {
          return {
            loading: true,
            error: null,
            totalRows: 0,
            progress: { stage: 'downloading' as ProgressStage, percent: 50, message: '', timestamp: Date.now() },
            logs: [],
            refresh: vi.fn(),
          }
        }
        return mockDefaultHookReturn()
      })

      render(<App />)
      fireEvent.click(screen.getByText(/demo dataset/i))

      await waitFor(() => {
        const logo = screen.getByAltText(/security ronin/i)
        expect(logo).toBeInTheDocument()
      })
    })

    it('logo has CRT green phosphor styling during loading', async () => {
      vi.mocked(useNetflowDataModule.useNetflowData).mockImplementation((url) => {
        if (url) {
          return {
            loading: true,
            error: null,
            totalRows: 0,
            progress: { stage: 'downloading' as ProgressStage, percent: 50, message: '', timestamp: Date.now() },
            logs: [],
            refresh: vi.fn(),
          }
        }
        return mockDefaultHookReturn()
      })

      render(<App />)
      fireEvent.click(screen.getByText(/demo dataset/i))

      await waitFor(() => {
        const logo = screen.getByAltText(/security ronin/i)
        expect(logo).toHaveClass('crt-logo')
      })
    })

    it('shows progress percentage', async () => {
      vi.mocked(useNetflowDataModule.useNetflowData).mockImplementation((url) => {
        if (url) {
          return {
            loading: true,
            error: null,
            totalRows: 0,
            progress: { stage: 'downloading' as ProgressStage, percent: 75, message: '', timestamp: Date.now() },
            logs: [],
            refresh: vi.fn(),
          }
        }
        return mockDefaultHookReturn()
      })

      render(<App />)
      fireEvent.click(screen.getByText(/demo dataset/i))

      await waitFor(() => {
        expect(screen.getByText('75%')).toBeInTheDocument()
      })
    })

    it('shows file name during loading', async () => {
      vi.mocked(useNetflowDataModule.useNetflowData).mockImplementation((url) => {
        if (url) {
          return {
            loading: true,
            error: null,
            totalRows: 0,
            progress: { stage: 'downloading' as ProgressStage, percent: 50, message: '', timestamp: Date.now() },
            logs: [],
            refresh: vi.fn(),
          }
        }
        return mockDefaultHookReturn()
      })

      render(<App />)
      fireEvent.click(screen.getByText(/demo dataset/i))

      await waitFor(() => {
        expect(screen.getByText(/UWF-ZeekData24\.parquet/i)).toBeInTheDocument()
      })
    })

    it('converts logs to CRT format with pending status for last log', async () => {
      vi.mocked(useNetflowDataModule.useNetflowData).mockImplementation((url) => {
        if (url) {
          return {
            loading: true,
            error: null,
            totalRows: 0,
            progress: { stage: 'downloading' as ProgressStage, percent: 50, message: '', timestamp: Date.now() },
            logs: [
              { level: 'info' as const, message: 'First message', timestamp: Date.now() },
              { level: 'info' as const, message: 'Second message', timestamp: Date.now() },
            ],
            refresh: vi.fn(),
          }
        }
        return mockDefaultHookReturn()
      })

      render(<App />)
      fireEvent.click(screen.getByText(/demo dataset/i))

      await waitFor(() => {
        // First log should be OK, last should be pending
        expect(screen.getByText('[OK]')).toBeInTheDocument()
        expect(screen.getByText('[..]')).toBeInTheDocument()
      })
    })

    it('shows all logs as OK when not loading', async () => {
      vi.mocked(useNetflowDataModule.useNetflowData).mockImplementation((url) => {
        if (url) {
          return {
            loading: false,
            error: 'some error',
            totalRows: 0,
            progress: { stage: 'complete' as ProgressStage, percent: 100, message: '', timestamp: Date.now() },
            logs: [
              { level: 'info' as const, message: 'Complete', timestamp: Date.now() },
            ],
            refresh: vi.fn(),
          }
        }
        return mockDefaultHookReturn()
      })

      render(<App />)
      fireEvent.click(screen.getByText(/demo dataset/i))

      await waitFor(() => {
        // When not loading, should show OK not pending
        expect(screen.queryByText('[..]')).not.toBeInTheDocument()
      })
    })

    it('shows MotherDuck footer during loading', async () => {
      vi.mocked(useNetflowDataModule.useNetflowData).mockImplementation((url) => {
        if (url) {
          return {
            loading: true,
            error: null,
            totalRows: 0,
            progress: { stage: 'downloading' as ProgressStage, percent: 50, message: '', timestamp: Date.now() },
            logs: [],
            refresh: vi.fn(),
          }
        }
        return mockDefaultHookReturn()
      })

      render(<App />)
      fireEvent.click(screen.getByText(/demo dataset/i))

      await waitFor(() => {
        expect(screen.getByText(/Security Ronin/i)).toBeInTheDocument()
      })
    })
  })

  describe('error state', () => {
    it('shows error with retry button', async () => {
      vi.mocked(useNetflowDataModule.useNetflowData).mockImplementation((url) => {
        if (url) {
          return {
            loading: false,
            error: 'Connection failed',
            totalRows: 0,
            progress: { stage: 'initializing' as ProgressStage, percent: 0, message: '', timestamp: Date.now() },
            logs: [],
            refresh: vi.fn(),
          }
        }
        return mockDefaultHookReturn()
      })

      render(<App />)

      const demoLink = screen.getByText(/demo dataset/i)
      fireEvent.click(demoLink)

      await waitFor(() => {
        expect(screen.getByText(/connection failed/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
      })
    })

    it('shows ERROR heading', async () => {
      vi.mocked(useNetflowDataModule.useNetflowData).mockImplementation((url) => {
        if (url) {
          return {
            loading: false,
            error: 'Test error',
            totalRows: 0,
            progress: { stage: 'initializing' as ProgressStage, percent: 0, message: '', timestamp: Date.now() },
            logs: [],
            refresh: vi.fn(),
          }
        }
        return mockDefaultHookReturn()
      })

      render(<App />)
      fireEvent.click(screen.getByText(/demo dataset/i))

      await waitFor(() => {
        expect(screen.getByText(/> ERROR/)).toBeInTheDocument()
      })
    })

    it('shows FAIL indicator with error message', async () => {
      vi.mocked(useNetflowDataModule.useNetflowData).mockImplementation((url) => {
        if (url) {
          return {
            loading: false,
            error: 'Network timeout',
            totalRows: 0,
            progress: { stage: 'initializing' as ProgressStage, percent: 0, message: '', timestamp: Date.now() },
            logs: [],
            refresh: vi.fn(),
          }
        }
        return mockDefaultHookReturn()
      })

      render(<App />)
      fireEvent.click(screen.getByText(/demo dataset/i))

      await waitFor(() => {
        expect(screen.getByText(/\[FAIL\]/)).toBeInTheDocument()
        expect(screen.getByText(/network timeout/i)).toBeInTheDocument()
      })
    })

    it('shows logo during error state', async () => {
      vi.mocked(useNetflowDataModule.useNetflowData).mockImplementation((url) => {
        if (url) {
          return {
            loading: false,
            error: 'Error',
            totalRows: 0,
            progress: { stage: 'initializing' as ProgressStage, percent: 0, message: '', timestamp: Date.now() },
            logs: [],
            refresh: vi.fn(),
          }
        }
        return mockDefaultHookReturn()
      })

      render(<App />)
      fireEvent.click(screen.getByText(/demo dataset/i))

      await waitFor(() => {
        const logo = screen.getByAltText(/security ronin/i)
        expect(logo).toBeInTheDocument()
      })
    })

    it('shows MotherDuck footer during error state', async () => {
      vi.mocked(useNetflowDataModule.useNetflowData).mockImplementation((url) => {
        if (url) {
          return {
            loading: false,
            error: 'Error',
            totalRows: 0,
            progress: { stage: 'initializing' as ProgressStage, percent: 0, message: '', timestamp: Date.now() },
            logs: [],
            refresh: vi.fn(),
          }
        }
        return mockDefaultHookReturn()
      })

      render(<App />)
      fireEvent.click(screen.getByText(/demo dataset/i))

      await waitFor(() => {
        expect(screen.getByText(/Security Ronin/i)).toBeInTheDocument()
      })
    })

    it('returns to landing page on retry', async () => {
      const mockHook = vi.fn().mockImplementation((url) => {
        if (url) {
          return {
            loading: false,
            error: 'Connection failed',
            totalRows: 0,
            progress: { stage: 'initializing' as ProgressStage, percent: 0, message: '', timestamp: Date.now() },
            logs: [],
            refresh: vi.fn(),
          }
        }
        return mockDefaultHookReturn()
      })

      vi.mocked(useNetflowDataModule.useNetflowData).mockImplementation(mockHook)

      render(<App />)

      const demoLink = screen.getByText(/demo dataset/i)
      fireEvent.click(demoLink)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
      })

      const retryButton = screen.getByRole('button', { name: /retry/i })
      fireEvent.click(retryButton)

      await waitFor(() => {
        expect(screen.getByTestId('landing-page')).toBeInTheDocument()
      })
    })

    it('resets data source on retry', async () => {
      let callCount = 0
      let lastUrl = ''

      vi.mocked(useNetflowDataModule.useNetflowData).mockImplementation((url) => {
        callCount++
        lastUrl = url

        if (url) {
          return {
            loading: false,
            error: 'Error',
            totalRows: 0,
            progress: { stage: 'initializing' as ProgressStage, percent: 0, message: '', timestamp: Date.now() },
            logs: [],
            refresh: vi.fn(),
          }
        }
        return mockDefaultHookReturn()
      })

      render(<App />)

      // Click demo to load
      fireEvent.click(screen.getByText(/demo dataset/i))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
      })

      // Click retry
      fireEvent.click(screen.getByRole('button', { name: /retry/i }))

      await waitFor(() => {
        expect(screen.getByTestId('landing-page')).toBeInTheDocument()
        // After retry, URL should be empty
        expect(lastUrl).toBe('')
      })
    })
  })

  describe('file drop handling', () => {
    it('handles file drop (falls back to demo data for now)', async () => {
      let capturedUrl = ''

      vi.mocked(useNetflowDataModule.useNetflowData).mockImplementation((url) => {
        capturedUrl = url
        return mockDefaultHookReturn()
      })

      render(<App />)

      const dropzone = screen.getByTestId('crt-dropzone')
      const file = new File(['test'], 'myflows.csv', { type: 'text/csv' })

      fireEvent.drop(dropzone, {
        dataTransfer: { files: [file] },
      })

      await waitFor(() => {
        // Currently falls back to demo URL
        expect(capturedUrl).toContain('.parquet')
      })
    })

    it('shows file name with fallback message', async () => {
      vi.mocked(useNetflowDataModule.useNetflowData).mockImplementation((url) => {
        if (url) {
          return {
            loading: true,
            error: null,
            totalRows: 0,
            progress: { stage: 'downloading' as ProgressStage, percent: 50, message: '', timestamp: Date.now() },
            logs: [],
            refresh: vi.fn(),
          }
        }
        return mockDefaultHookReturn()
      })

      render(<App />)

      const dropzone = screen.getByTestId('crt-dropzone')
      const file = new File(['test'], 'myflows.csv', { type: 'text/csv' })

      fireEvent.drop(dropzone, {
        dataTransfer: { files: [file] },
      })

      await waitFor(() => {
        expect(screen.getByText(/myflows\.csv.*using demo data/i)).toBeInTheDocument()
      })
    })
  })

  describe('dashboard state', () => {
    it('shows ForensicDashboard when loaded successfully', async () => {
      vi.mocked(useNetflowDataModule.useNetflowData).mockImplementation((url) => {
        if (url) {
          return {
            loading: false,
            error: null,
            totalRows: 1000,
            progress: { stage: 'complete' as ProgressStage, percent: 100, message: '', timestamp: Date.now() },
            logs: [],
            refresh: vi.fn(),
          }
        }
        return mockDefaultHookReturn()
      })

      render(<App />)
      fireEvent.click(screen.getByText(/demo dataset/i))

      await waitFor(() => {
        expect(screen.getByTestId('forensic-dashboard')).toBeInTheDocument()
      })
    })

    it('does not show landing page when dashboard is visible', async () => {
      vi.mocked(useNetflowDataModule.useNetflowData).mockImplementation((url) => {
        if (url) {
          return {
            loading: false,
            error: null,
            totalRows: 1000,
            progress: { stage: 'complete' as ProgressStage, percent: 100, message: '', timestamp: Date.now() },
            logs: [],
            refresh: vi.fn(),
          }
        }
        return mockDefaultHookReturn()
      })

      render(<App />)
      fireEvent.click(screen.getByText(/demo dataset/i))

      await waitFor(() => {
        expect(screen.queryByTestId('landing-page')).not.toBeInTheDocument()
        expect(screen.queryByTestId('crt-dropzone')).not.toBeInTheDocument()
      })
    })
  })

  describe('URL parsing', () => {
    it('extracts file name from demo URL', async () => {
      vi.mocked(useNetflowDataModule.useNetflowData).mockImplementation((url) => {
        if (url) {
          return {
            loading: true,
            error: null,
            totalRows: 0,
            progress: { stage: 'downloading' as ProgressStage, percent: 50, message: '', timestamp: Date.now() },
            logs: [],
            refresh: vi.fn(),
          }
        }
        return mockDefaultHookReturn()
      })

      render(<App />)
      fireEvent.click(screen.getByText(/demo dataset/i))

      await waitFor(() => {
        expect(screen.getByText(/UWF-ZeekData24\.parquet/i)).toBeInTheDocument()
      })
    })
  })

  describe('CRT styling', () => {
    it('has CRT container class on loading state', async () => {
      vi.mocked(useNetflowDataModule.useNetflowData).mockImplementation((url) => {
        if (url) {
          return {
            loading: true,
            error: null,
            totalRows: 0,
            progress: { stage: 'downloading' as ProgressStage, percent: 50, message: '', timestamp: Date.now() },
            logs: [],
            refresh: vi.fn(),
          }
        }
        return mockDefaultHookReturn()
      })

      render(<App />)
      fireEvent.click(screen.getByText(/demo dataset/i))

      await waitFor(() => {
        const container = document.querySelector('.crt-container')
        expect(container).toBeInTheDocument()
      })
    })

    it('has CRT scanlines class on loading state', async () => {
      vi.mocked(useNetflowDataModule.useNetflowData).mockImplementation((url) => {
        if (url) {
          return {
            loading: true,
            error: null,
            totalRows: 0,
            progress: { stage: 'downloading' as ProgressStage, percent: 50, message: '', timestamp: Date.now() },
            logs: [],
            refresh: vi.fn(),
          }
        }
        return mockDefaultHookReturn()
      })

      render(<App />)
      fireEvent.click(screen.getByText(/demo dataset/i))

      await waitFor(() => {
        const container = document.querySelector('.crt-scanlines')
        expect(container).toBeInTheDocument()
      })
    })

    it('has CRT container class on error state', async () => {
      vi.mocked(useNetflowDataModule.useNetflowData).mockImplementation((url) => {
        if (url) {
          return {
            loading: false,
            error: 'Error',
            totalRows: 0,
            progress: { stage: 'initializing' as ProgressStage, percent: 0, message: '', timestamp: Date.now() },
            logs: [],
            refresh: vi.fn(),
          }
        }
        return mockDefaultHookReturn()
      })

      render(<App />)
      fireEvent.click(screen.getByText(/demo dataset/i))

      await waitFor(() => {
        const container = document.querySelector('.crt-container')
        expect(container).toBeInTheDocument()
      })
    })
  })

  describe('multiple interactions', () => {
    it('handles demo click after retry', async () => {
      let urlHistory: string[] = []

      vi.mocked(useNetflowDataModule.useNetflowData).mockImplementation((url) => {
        urlHistory.push(url)

        if (url) {
          return {
            loading: false,
            error: 'First error',
            totalRows: 0,
            progress: { stage: 'initializing' as ProgressStage, percent: 0, message: '', timestamp: Date.now() },
            logs: [],
            refresh: vi.fn(),
          }
        }
        return mockDefaultHookReturn()
      })

      render(<App />)

      // First demo click
      fireEvent.click(screen.getByText(/demo dataset/i))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
      })

      // Retry
      fireEvent.click(screen.getByRole('button', { name: /retry/i }))

      await waitFor(() => {
        expect(screen.getByTestId('landing-page')).toBeInTheDocument()
      })

      // Second demo click
      fireEvent.click(screen.getByText(/demo dataset/i))

      await waitFor(() => {
        // Should have called useNetflowData with URL again
        expect(urlHistory.filter(u => u.includes('.parquet')).length).toBeGreaterThanOrEqual(2)
      })
    })
  })

  describe('accessibility', () => {
    it('logo link has accessible attributes', async () => {
      vi.mocked(useNetflowDataModule.useNetflowData).mockImplementation((url) => {
        if (url) {
          return {
            loading: true,
            error: null,
            totalRows: 0,
            progress: { stage: 'downloading' as ProgressStage, percent: 50, message: '', timestamp: Date.now() },
            logs: [],
            refresh: vi.fn(),
          }
        }
        return mockDefaultHookReturn()
      })

      render(<App />)
      fireEvent.click(screen.getByText(/demo dataset/i))

      await waitFor(() => {
        const logoLink = screen.getByRole('link', { name: /security ronin/i })
        expect(logoLink).toHaveAttribute('href', 'https://www.securityronin.com/')
        expect(logoLink).toHaveAttribute('target', '_blank')
        expect(logoLink).toHaveAttribute('rel', 'noopener noreferrer')
      })
    })

    it('retry button is accessible', async () => {
      vi.mocked(useNetflowDataModule.useNetflowData).mockImplementation((url) => {
        if (url) {
          return {
            loading: false,
            error: 'Error',
            totalRows: 0,
            progress: { stage: 'initializing' as ProgressStage, percent: 0, message: '', timestamp: Date.now() },
            logs: [],
            refresh: vi.fn(),
          }
        }
        return mockDefaultHookReturn()
      })

      render(<App />)
      fireEvent.click(screen.getByText(/demo dataset/i))

      await waitFor(() => {
        const retryButton = screen.getByRole('button', { name: /retry/i })
        expect(retryButton).toBeInTheDocument()
        expect(retryButton).toBeEnabled()
      })
    })
  })

  describe('edge cases', () => {
    it('handles empty logs array', async () => {
      vi.mocked(useNetflowDataModule.useNetflowData).mockImplementation((url) => {
        if (url) {
          return {
            loading: true,
            error: null,
            totalRows: 0,
            progress: { stage: 'downloading' as ProgressStage, percent: 50, message: '', timestamp: Date.now() },
            logs: [],
            refresh: vi.fn(),
          }
        }
        return mockDefaultHookReturn()
      })

      render(<App />)
      fireEvent.click(screen.getByText(/demo dataset/i))

      await waitFor(() => {
        // Should render without error
        expect(screen.getByText(/UWF-ZeekData24\.parquet/i)).toBeInTheDocument()
        expect(screen.queryByText('[OK]')).not.toBeInTheDocument()
        expect(screen.queryByText('[..]')).not.toBeInTheDocument()
      })
    })

    it('handles single log entry', async () => {
      vi.mocked(useNetflowDataModule.useNetflowData).mockImplementation((url) => {
        if (url) {
          return {
            loading: true,
            error: null,
            totalRows: 0,
            progress: { stage: 'downloading' as ProgressStage, percent: 50, message: '', timestamp: Date.now() },
            logs: [
              { level: 'info' as const, message: 'Only entry', timestamp: Date.now() },
            ],
            refresh: vi.fn(),
          }
        }
        return mockDefaultHookReturn()
      })

      render(<App />)
      fireEvent.click(screen.getByText(/demo dataset/i))

      await waitFor(() => {
        expect(screen.getByText('Only entry')).toBeInTheDocument()
        expect(screen.getByText('[..]')).toBeInTheDocument()
      })
    })

    it('handles many log entries', async () => {
      const manyLogs = Array.from({ length: 20 }, (_, i) => ({
        level: 'info' as const,
        message: `Log entry ${i}`,
        timestamp: Date.now(),
      }))

      vi.mocked(useNetflowDataModule.useNetflowData).mockImplementation((url) => {
        if (url) {
          return {
            loading: true,
            error: null,
            totalRows: 0,
            progress: { stage: 'downloading' as ProgressStage, percent: 50, message: '', timestamp: Date.now() },
            logs: manyLogs,
            refresh: vi.fn(),
          }
        }
        return mockDefaultHookReturn()
      })

      render(<App />)
      fireEvent.click(screen.getByText(/demo dataset/i))

      await waitFor(() => {
        expect(screen.getByText('Log entry 0')).toBeInTheDocument()
        expect(screen.getByText('Log entry 19')).toBeInTheDocument()
        expect(screen.getAllByText('[OK]')).toHaveLength(19)
        expect(screen.getByText('[..]')).toBeInTheDocument()
      })
    })

    it('handles zero progress', async () => {
      vi.mocked(useNetflowDataModule.useNetflowData).mockImplementation((url) => {
        if (url) {
          return {
            loading: true,
            error: null,
            totalRows: 0,
            progress: { stage: 'initializing' as ProgressStage, percent: 0, message: '', timestamp: Date.now() },
            logs: [],
            refresh: vi.fn(),
          }
        }
        return mockDefaultHookReturn()
      })

      render(<App />)
      fireEvent.click(screen.getByText(/demo dataset/i))

      await waitFor(() => {
        expect(screen.getByText('0%')).toBeInTheDocument()
      })
    })

    it('handles 100% progress', async () => {
      vi.mocked(useNetflowDataModule.useNetflowData).mockImplementation((url) => {
        if (url) {
          return {
            loading: true,
            error: null,
            totalRows: 0,
            progress: { stage: 'complete' as ProgressStage, percent: 100, message: '', timestamp: Date.now() },
            logs: [],
            refresh: vi.fn(),
          }
        }
        return mockDefaultHookReturn()
      })

      render(<App />)
      fireEvent.click(screen.getByText(/demo dataset/i))

      await waitFor(() => {
        expect(screen.getByText('100%')).toBeInTheDocument()
      })
    })

    it('handles very long error message', async () => {
      const longError = 'Error: ' + 'x'.repeat(500)

      vi.mocked(useNetflowDataModule.useNetflowData).mockImplementation((url) => {
        if (url) {
          return {
            loading: false,
            error: longError,
            totalRows: 0,
            progress: { stage: 'initializing' as ProgressStage, percent: 0, message: '', timestamp: Date.now() },
            logs: [],
            refresh: vi.fn(),
          }
        }
        return mockDefaultHookReturn()
      })

      render(<App />)
      fireEvent.click(screen.getByText(/demo dataset/i))

      await waitFor(() => {
        expect(screen.getByText(new RegExp(longError.slice(0, 50)))).toBeInTheDocument()
      })
    })
  })
})
