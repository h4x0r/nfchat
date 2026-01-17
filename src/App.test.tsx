import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import App from './App'
import * as useNetflowDataModule from '@/hooks/useNetflowData'

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
vi.mock('@/components/dashboard/timeline', () => ({
  ProTimeline: () => <div data-testid="timeline-mock">ProTimeline</div>,
}))

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('initial state', () => {
    it('shows landing page with dropzone initially', () => {
      vi.mocked(useNetflowDataModule.useNetflowData).mockReturnValue({
        loading: false,
        error: null,
        totalRows: 0,
        progress: { stage: 'initializing', percent: 0, message: '', timestamp: Date.now() },
        logs: [],
        refresh: vi.fn(),
      })

      render(<App />)

      expect(screen.getByTestId('landing-page')).toBeInTheDocument()
      expect(screen.getByTestId('crt-dropzone')).toBeInTheDocument()
    })

    it('shows demo dataset link', () => {
      vi.mocked(useNetflowDataModule.useNetflowData).mockReturnValue({
        loading: false,
        error: null,
        totalRows: 0,
        progress: { stage: 'initializing', percent: 0, message: '', timestamp: Date.now() },
        logs: [],
        refresh: vi.fn(),
      })

      render(<App />)

      expect(screen.getByText(/demo dataset/i)).toBeInTheDocument()
    })
  })

  describe('demo data loading', () => {
    it('uses external CDN URL when demo clicked', async () => {
      let capturedUrl = ''

      vi.mocked(useNetflowDataModule.useNetflowData).mockImplementation((url) => {
        capturedUrl = url
        return {
          loading: false,
          error: null,
          totalRows: 0,
          progress: { stage: 'initializing', percent: 0, message: '', timestamp: Date.now() },
          logs: [],
          refresh: vi.fn(),
        }
      })

      render(<App />)

      const demoLink = screen.getByText(/demo dataset/i)
      fireEvent.click(demoLink)

      await waitFor(() => {
        expect(capturedUrl).toMatch(/^https:\/\//)
        expect(capturedUrl).toContain('.parquet')
      })
    })

    it('shows CRT loading log when loading', async () => {
      vi.mocked(useNetflowDataModule.useNetflowData).mockImplementation((url) => {
        if (url) {
          return {
            loading: true,
            error: null,
            totalRows: 0,
            progress: { stage: 'downloading', percent: 50, message: 'Loading...', timestamp: Date.now() },
            logs: [
              { level: 'info', message: 'Connecting to MotherDuck...', timestamp: Date.now() },
              { level: 'info', message: 'Loading data...', timestamp: Date.now() },
            ],
            refresh: vi.fn(),
          }
        }
        return {
          loading: false,
          error: null,
          totalRows: 0,
          progress: { stage: 'initializing', percent: 0, message: '', timestamp: Date.now() },
          logs: [],
          refresh: vi.fn(),
        }
      })

      render(<App />)

      const demoLink = screen.getByText(/demo dataset/i)
      fireEvent.click(demoLink)

      await waitFor(() => {
        // When loading, dropzone should disappear and CRT loading should be visible
        expect(screen.queryByTestId('crt-dropzone')).not.toBeInTheDocument()
        // Should show the Powered by MotherDuck footer (present in loading state)
        expect(screen.getByText(/Powered by MotherDuck/i)).toBeInTheDocument()
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
            progress: { stage: 'initializing', percent: 0, message: '', timestamp: Date.now() },
            logs: [],
            refresh: vi.fn(),
          }
        }
        return {
          loading: false,
          error: null,
          totalRows: 0,
          progress: { stage: 'initializing', percent: 0, message: '', timestamp: Date.now() },
          logs: [],
          refresh: vi.fn(),
        }
      })

      render(<App />)

      const demoLink = screen.getByText(/demo dataset/i)
      fireEvent.click(demoLink)

      await waitFor(() => {
        expect(screen.getByText(/connection failed/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
      })
    })

    it('returns to landing page on retry', async () => {
      const mockHook = vi.fn().mockImplementation((url) => {
        if (url) {
          return {
            loading: false,
            error: 'Connection failed',
            totalRows: 0,
            progress: { stage: 'initializing', percent: 0, message: '', timestamp: Date.now() },
            logs: [],
            refresh: vi.fn(),
          }
        }
        return {
          loading: false,
          error: null,
          totalRows: 0,
          progress: { stage: 'initializing', percent: 0, message: '', timestamp: Date.now() },
          logs: [],
          refresh: vi.fn(),
        }
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
  })
})
