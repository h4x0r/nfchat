import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FileUploader } from './FileUploader'

describe('FileUploader', () => {
  const mockOnFileSelect = vi.fn()
  const defaultProps = {
    onFileSelect: mockOnFileSelect,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('renders the uploader container', () => {
      render(<FileUploader {...defaultProps} />)
      expect(screen.getByTestId('uploader')).toBeInTheDocument()
    })

    it('renders drag-drop zone', () => {
      render(<FileUploader {...defaultProps} />)
      expect(screen.getByText(/drag.*drop/i)).toBeInTheDocument()
    })

    it('renders file type hints for parquet', () => {
      render(<FileUploader {...defaultProps} />)
      expect(screen.getByText(/parquet/i)).toBeInTheDocument()
    })

    it('renders load button', () => {
      render(<FileUploader {...defaultProps} />)
      expect(screen.getByRole('button', { name: /load/i })).toBeInTheDocument()
    })
  })

  describe('file selection', () => {
    it('has file input that accepts parquet files', () => {
      render(<FileUploader {...defaultProps} />)
      const input = screen.getByTestId('file-input')
      expect(input).toHaveAttribute('accept', '.parquet')
    })

    it('shows selected file name after selection', async () => {
      render(<FileUploader {...defaultProps} />)
      const input = screen.getByTestId('file-input') as HTMLInputElement

      const file = new File(['test'], 'flows.parquet', { type: 'application/octet-stream' })
      fireEvent.change(input, { target: { files: [file] } })

      expect(screen.getByText(/flows\.parquet/)).toBeInTheDocument()
    })

    it('shows file size after selection', async () => {
      render(<FileUploader {...defaultProps} />)
      const input = screen.getByTestId('file-input') as HTMLInputElement

      const file = new File(['test content here'], 'flows.parquet', { type: 'application/octet-stream' })
      fireEvent.change(input, { target: { files: [file] } })

      // Should show size
      expect(screen.getByText(/size/i)).toBeInTheDocument()
    })
  })

  describe('load button', () => {
    it('disables load button when no file selected', () => {
      render(<FileUploader {...defaultProps} />)
      const button = screen.getByRole('button', { name: /load/i })
      expect(button).toBeDisabled()
    })

    it('enables load button when file is selected', () => {
      render(<FileUploader {...defaultProps} />)
      const input = screen.getByTestId('file-input') as HTMLInputElement

      const file = new File(['test'], 'flows.parquet', { type: 'application/octet-stream' })
      fireEvent.change(input, { target: { files: [file] } })

      const button = screen.getByRole('button', { name: /load/i })
      expect(button).not.toBeDisabled()
    })

    it('calls onFileSelect when load button clicked', () => {
      render(<FileUploader {...defaultProps} />)
      const input = screen.getByTestId('file-input') as HTMLInputElement

      const file = new File(['test'], 'flows.parquet', { type: 'application/octet-stream' })
      fireEvent.change(input, { target: { files: [file] } })

      const button = screen.getByRole('button', { name: /load/i })
      fireEvent.click(button)

      expect(mockOnFileSelect).toHaveBeenCalledWith(file)
    })
  })

  describe('drag and drop', () => {
    it('handles drag over event', () => {
      render(<FileUploader {...defaultProps} />)
      const dropZone = screen.getByTestId('drop-zone')

      const dragEvent = { preventDefault: vi.fn(), stopPropagation: vi.fn() }
      fireEvent.dragOver(dropZone, dragEvent)

      // Should not throw
      expect(screen.getByTestId('uploader')).toBeInTheDocument()
    })
  })

  describe('error handling', () => {
    it('does not show error message initially', () => {
      render(<FileUploader {...defaultProps} />)
      expect(screen.queryByTestId('error-message')).not.toBeInTheDocument()
    })

    it('shows error for non-parquet files', () => {
      render(<FileUploader {...defaultProps} />)
      const input = screen.getByTestId('file-input') as HTMLInputElement

      const file = new File(['test'], 'data.csv', { type: 'text/csv' })
      fireEvent.change(input, { target: { files: [file] } })

      expect(screen.getByTestId('error-message')).toBeInTheDocument()
      expect(screen.getByText(/parquet files only/i)).toBeInTheDocument()
    })
  })

  describe('loading state', () => {
    it('accepts isLoading prop', () => {
      render(<FileUploader {...defaultProps} isLoading={true} />)
      expect(screen.getByText(/loading/i)).toBeInTheDocument()
    })

    it('disables button when loading', () => {
      render(<FileUploader {...defaultProps} isLoading={true} />)
      const button = screen.getByRole('button', { name: /loading/i })
      expect(button).toBeDisabled()
    })
  })
})
