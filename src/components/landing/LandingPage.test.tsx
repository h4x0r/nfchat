import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { LandingPage } from './LandingPage'

describe('LandingPage', () => {
  describe('initial rendering', () => {
    it('renders Security Ronin logo', () => {
      render(<LandingPage onDataReady={vi.fn()} />)

      const logo = screen.getByAltText(/security ronin/i)
      expect(logo).toBeInTheDocument()
    })

    it('logo links to securityronin.com', () => {
      render(<LandingPage onDataReady={vi.fn()} />)

      const link = screen.getByRole('link', { name: /security ronin/i })
      expect(link).toHaveAttribute('href', 'https://www.securityronin.com/')
      expect(link).toHaveAttribute('target', '_blank')
    })

    it('logo opens in new tab safely', () => {
      render(<LandingPage onDataReady={vi.fn()} />)

      const link = screen.getByRole('link', { name: /security ronin/i })
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    })

    it('renders headline with blinking cursor', () => {
      render(<LandingPage onDataReady={vi.fn()} />)

      expect(screen.getByText(/interrogate your netflow data/i)).toBeInTheDocument()
    })

    it('headline has CRT cursor class', () => {
      render(<LandingPage onDataReady={vi.fn()} />)

      const headline = screen.getByText(/interrogate your netflow data/i)
      expect(headline).toHaveClass('crt-cursor')
    })

    it('renders dropzone in ready state', () => {
      render(<LandingPage onDataReady={vi.fn()} />)

      expect(screen.getByTestId('crt-dropzone')).toBeInTheDocument()
      expect(screen.getByText(/drop file here/i)).toBeInTheDocument()
      expect(screen.getByText(/CSV, Parquet, or ZIP/i)).toBeInTheDocument()
    })

    it('renders demo data link', () => {
      render(<LandingPage onDataReady={vi.fn()} />)

      expect(screen.getByText(/demo dataset/i)).toBeInTheDocument()
    })

    it('shows demo dataset size hint', () => {
      render(<LandingPage onDataReady={vi.fn()} />)

      expect(screen.getByText(/2\.4M flows/i)).toBeInTheDocument()
    })

    it('has CRT terminal aesthetic', () => {
      render(<LandingPage onDataReady={vi.fn()} />)

      const container = screen.getByTestId('landing-page')
      expect(container).toHaveClass('crt-container')
    })

    it('has scanlines effect', () => {
      render(<LandingPage onDataReady={vi.fn()} />)

      const container = screen.getByTestId('landing-page')
      expect(container).toHaveClass('crt-scanlines')
    })

    it('renders MotherDuck footer', () => {
      render(<LandingPage onDataReady={vi.fn()} />)

      expect(screen.getByText(/Security Ronin/i)).toBeInTheDocument()
    })
  })

  describe('file drop behavior', () => {
    it('transitions to loading state when file dropped', async () => {
      render(<LandingPage onDataReady={vi.fn()} />)

      const dropzone = screen.getByTestId('crt-dropzone')
      const file = new File(['a,b,c'], 'flows.csv', { type: 'text/csv' })

      fireEvent.drop(dropzone, {
        dataTransfer: { files: [file] },
      })

      await waitFor(() => {
        expect(screen.getByText(/loading.*flows\.csv/i)).toBeInTheDocument()
      })
    })

    it('calls onDataReady with file type and file', async () => {
      const onDataReady = vi.fn()
      render(<LandingPage onDataReady={onDataReady} />)

      const dropzone = screen.getByTestId('crt-dropzone')
      const file = new File(['a,b,c'], 'flows.csv', { type: 'text/csv' })

      fireEvent.drop(dropzone, {
        dataTransfer: { files: [file] },
      })

      expect(onDataReady).toHaveBeenCalledWith({ type: 'file', file })
    })

    it('hides dropzone after file drop', async () => {
      render(<LandingPage onDataReady={vi.fn()} />)

      const dropzone = screen.getByTestId('crt-dropzone')
      const file = new File(['a,b,c'], 'flows.csv', { type: 'text/csv' })

      fireEvent.drop(dropzone, {
        dataTransfer: { files: [file] },
      })

      await waitFor(() => {
        expect(screen.queryByTestId('crt-dropzone')).not.toBeInTheDocument()
      })
    })

    it('hides demo link after file drop', async () => {
      render(<LandingPage onDataReady={vi.fn()} />)

      const dropzone = screen.getByTestId('crt-dropzone')
      const file = new File(['a,b,c'], 'test.parquet', { type: 'application/octet-stream' })

      fireEvent.drop(dropzone, {
        dataTransfer: { files: [file] },
      })

      await waitFor(() => {
        expect(screen.queryByText(/demo dataset/i)).not.toBeInTheDocument()
      })
    })

    it('shows loading log after file drop', async () => {
      render(<LandingPage onDataReady={vi.fn()} />)

      const dropzone = screen.getByTestId('crt-dropzone')
      const file = new File(['a,b,c'], 'mydata.csv', { type: 'text/csv' })

      fireEvent.drop(dropzone, {
        dataTransfer: { files: [file] },
      })

      await waitFor(() => {
        expect(screen.getByText(/processing file/i)).toBeInTheDocument()
      })
    })
  })

  describe('demo data behavior', () => {
    it('shows loading state when demo data clicked', async () => {
      render(<LandingPage onDataReady={vi.fn()} />)

      const demoLink = screen.getByText(/demo dataset/i)
      fireEvent.click(demoLink)

      await waitFor(() => {
        expect(screen.getByText(/loading/i)).toBeInTheDocument()
      })
    })

    it('calls onDataReady with URL type', async () => {
      const onDataReady = vi.fn()
      render(<LandingPage onDataReady={onDataReady} />)

      const demoLink = screen.getByText(/demo dataset/i)
      fireEvent.click(demoLink)

      expect(onDataReady).toHaveBeenCalledWith({
        type: 'url',
        url: expect.stringContaining('.parquet'),
      })
    })

    it('hides dropzone after demo click', async () => {
      render(<LandingPage onDataReady={vi.fn()} />)

      const demoLink = screen.getByText(/demo dataset/i)
      fireEvent.click(demoLink)

      await waitFor(() => {
        expect(screen.queryByTestId('crt-dropzone')).not.toBeInTheDocument()
      })
    })

    it('hides demo link after demo click', async () => {
      render(<LandingPage onDataReady={vi.fn()} />)

      const demoLink = screen.getByText(/demo dataset/i)
      fireEvent.click(demoLink)

      await waitFor(() => {
        expect(screen.queryByText(/demo dataset/i)).not.toBeInTheDocument()
      })
    })

    it('shows connecting message after demo click', async () => {
      render(<LandingPage onDataReady={vi.fn()} />)

      const demoLink = screen.getByText(/demo dataset/i)
      fireEvent.click(demoLink)

      await waitFor(() => {
        expect(screen.getByText(/connecting to motherduck/i)).toBeInTheDocument()
      })
    })

    it('shows correct demo file name', async () => {
      render(<LandingPage onDataReady={vi.fn()} />)

      const demoLink = screen.getByText(/demo dataset/i)
      fireEvent.click(demoLink)

      await waitFor(() => {
        expect(screen.getByText(/UWF-ZeekData24\.parquet/i)).toBeInTheDocument()
      })
    })
  })

  describe('loading state', () => {
    it('shows CRTLoadingLog in loading state', async () => {
      render(<LandingPage onDataReady={vi.fn()} />)

      const demoLink = screen.getByText(/demo dataset/i)
      fireEvent.click(demoLink)

      await waitFor(() => {
        // Check for loading log elements
        expect(screen.getByText(/loading/i)).toBeInTheDocument()
      })
    })

    it('shows progress at 0% initially in loading', async () => {
      render(<LandingPage onDataReady={vi.fn()} />)

      const demoLink = screen.getByText(/demo dataset/i)
      fireEvent.click(demoLink)

      await waitFor(() => {
        expect(screen.getByText('0%')).toBeInTheDocument()
      })
    })

    it('shows pending status indicator in loading', async () => {
      render(<LandingPage onDataReady={vi.fn()} />)

      const demoLink = screen.getByText(/demo dataset/i)
      fireEvent.click(demoLink)

      await waitFor(() => {
        expect(screen.getByText('[..]')).toBeInTheDocument()
      })
    })
  })

  describe('multiple interactions', () => {
    it('handles rapid demo clicks', async () => {
      const onDataReady = vi.fn()
      render(<LandingPage onDataReady={onDataReady} />)

      const demoLink = screen.getByText(/demo dataset/i)

      // Click multiple times rapidly
      fireEvent.click(demoLink)
      fireEvent.click(demoLink)
      fireEvent.click(demoLink)

      // Should only call onDataReady once (first click)
      expect(onDataReady).toHaveBeenCalledTimes(1)
    })
  })

  describe('styling and layout', () => {
    it('centers content vertically and horizontally', () => {
      render(<LandingPage onDataReady={vi.fn()} />)

      const container = screen.getByTestId('landing-page')
      expect(container).toHaveClass('flex')
      expect(container).toHaveClass('items-center')
      expect(container).toHaveClass('justify-center')
    })

    it('has minimum height of screen', () => {
      render(<LandingPage onDataReady={vi.fn()} />)

      const container = screen.getByTestId('landing-page')
      expect(container).toHaveClass('min-h-screen')
    })

    it('has proper padding', () => {
      render(<LandingPage onDataReady={vi.fn()} />)

      const container = screen.getByTestId('landing-page')
      expect(container).toHaveClass('p-8')
    })

    it('constrains content width', () => {
      render(<LandingPage onDataReady={vi.fn()} />)

      // Find the content wrapper
      const logo = screen.getByAltText(/security ronin/i)
      const wrapper = logo.closest('.max-w-xl')
      expect(wrapper).toBeInTheDocument()
    })

    it('logo has correct height', () => {
      render(<LandingPage onDataReady={vi.fn()} />)

      const logo = screen.getByAltText(/security ronin/i)
      expect(logo).toHaveClass('h-24')
    })

    it('logo has CRT green phosphor styling', () => {
      render(<LandingPage onDataReady={vi.fn()} />)

      const logo = screen.getByAltText(/security ronin/i)
      expect(logo).toHaveClass('crt-logo')
    })

    it('headline has glow effect', () => {
      render(<LandingPage onDataReady={vi.fn()} />)

      const headline = screen.getByText(/interrogate your netflow data/i)
      expect(headline).toHaveClass('crt-glow')
    })

    it('footer has dim glow effect', () => {
      render(<LandingPage onDataReady={vi.fn()} />)

      const footer = screen.getByText(/Security Ronin/i)
      expect(footer.closest('div')).toHaveClass('crt-glow-dim')
    })

    it('demo link has crt-link class', () => {
      render(<LandingPage onDataReady={vi.fn()} />)

      const demoLink = screen.getByText(/demo dataset/i)
      expect(demoLink).toHaveClass('crt-link')
    })
  })

  describe('accessibility', () => {
    it('logo link has accessible name', () => {
      render(<LandingPage onDataReady={vi.fn()} />)

      const link = screen.getByRole('link', { name: /security ronin/i })
      expect(link).toBeInTheDocument()
    })

    it('demo button is a clickable button', () => {
      render(<LandingPage onDataReady={vi.fn()} />)

      const demoLink = screen.getByText(/demo dataset/i)
      expect(demoLink.tagName).toBe('BUTTON')
    })

    it('page has data-testid for testing', () => {
      render(<LandingPage onDataReady={vi.fn()} />)

      expect(screen.getByTestId('landing-page')).toBeInTheDocument()
    })
  })
})
