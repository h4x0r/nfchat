import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import App from './App'
import * as useNetflowDataModule from '@/hooks/useNetflowData'

// Mock the hooks
vi.mock('@/hooks/useNetflowData', () => ({
  useNetflowData: vi.fn(),
}))

// Mock duckdb functions
vi.mock('@/lib/duckdb', () => ({
  loadParquetFromFile: vi.fn(),
  loadCSVFromFile: vi.fn(),
  loadZipFile: vi.fn(),
  getTimelineData: vi.fn().mockResolvedValue([]),
  getAttackDistribution: vi.fn().mockResolvedValue([]),
  getTopTalkers: vi.fn().mockResolvedValue([]),
  getFlows: vi.fn().mockResolvedValue([]),
  getFlowCount: vi.fn().mockResolvedValue(0),
}))

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('demo data URL', () => {
    it('uses external CDN URL to avoid build-time download', async () => {
      const user = userEvent.setup()
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

      const demoTab = screen.getByRole('tab', { name: /demo data/i })
      await user.click(demoTab)

      const loadButton = await screen.findByRole('button', { name: /load demo dataset/i })
      await user.click(loadButton)

      await waitFor(() => {
        expect(capturedUrl).toMatch(/^https:\/\//)
      })
    })
  })

  describe('loading state with progress bar', () => {
    it('shows progress bar when loading demo data', async () => {
      const user = userEvent.setup()

      // Mock returns loading state after button click triggers URL change
      vi.mocked(useNetflowDataModule.useNetflowData).mockImplementation((url) => {
        if (url) {
          return {
            loading: true,
            error: null,
            totalRows: 0,
            progress: { stage: 'downloading', percent: 50, message: 'Loading data...', timestamp: Date.now() },
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

      // Switch to Demo Data tab first
      const demoTab = screen.getByRole('tab', { name: /demo data/i })
      await user.click(demoTab)

      // Find and click the Load Demo Dataset button
      const loadButton = await screen.findByRole('button', { name: /load demo dataset/i })
      await user.click(loadButton)

      await waitFor(() => {
        expect(screen.getByRole('progressbar')).toBeInTheDocument()
      })
      // LoadingProgress displays stageLabels[stage] as the stage header
      expect(screen.getByText('Downloading')).toBeInTheDocument()
      // And the message as supplementary text
      expect(screen.getByText('Loading data...')).toBeInTheDocument()
    })

    it('shows progress stage text during loading', async () => {
      const user = userEvent.setup()

      vi.mocked(useNetflowDataModule.useNetflowData).mockImplementation((url) => {
        if (url) {
          return {
            loading: true,
            error: null,
            totalRows: 0,
            progress: { stage: 'building', percent: 70, message: 'Building dashboard...', timestamp: Date.now() },
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

      // Switch to Demo Data tab first
      const demoTab = screen.getByRole('tab', { name: /demo data/i })
      await user.click(demoTab)

      // Find and click the Load Demo Dataset button
      const loadButton = await screen.findByRole('button', { name: /load demo dataset/i })
      await user.click(loadButton)

      await waitFor(() => {
        // LoadingProgress displays "Building Dashboard" for the 'building' stage
        expect(screen.getByText('Building Dashboard')).toBeInTheDocument()
      })
      expect(screen.getByText('Building dashboard...')).toBeInTheDocument()
    })
  })
})
