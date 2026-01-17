import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { LandingPage } from './LandingPage'

describe('LandingPage', () => {
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

  it('renders headline with blinking cursor', () => {
    render(<LandingPage onDataReady={vi.fn()} />)

    expect(screen.getByText(/interrogate your netflow data/i)).toBeInTheDocument()
  })

  it('renders dropzone in ready state', () => {
    render(<LandingPage onDataReady={vi.fn()} />)

    expect(screen.getByTestId('crt-dropzone')).toBeInTheDocument()
    expect(screen.getByText(/drop file here/i)).toBeInTheDocument()
  })

  it('renders demo data link', () => {
    render(<LandingPage onDataReady={vi.fn()} />)

    expect(screen.getByText(/demo dataset/i)).toBeInTheDocument()
  })

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

  it('shows loading state when demo data clicked', async () => {
    render(<LandingPage onDataReady={vi.fn()} />)

    const demoLink = screen.getByText(/demo dataset/i)
    fireEvent.click(demoLink)

    await waitFor(() => {
      expect(screen.getByText(/loading/i)).toBeInTheDocument()
    })
  })

  it('has CRT terminal aesthetic', () => {
    render(<LandingPage onDataReady={vi.fn()} />)

    const container = screen.getByTestId('landing-page')
    expect(container).toHaveClass('crt-container')
  })
})
