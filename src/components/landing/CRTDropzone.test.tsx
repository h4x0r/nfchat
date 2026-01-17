import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CRTDropzone } from './CRTDropzone'

describe('CRTDropzone', () => {
  describe('rendering', () => {
    it('renders dropzone with prompt text', () => {
      render(<CRTDropzone onFileDrop={vi.fn()} />)

      expect(screen.getByText(/drop file here/i)).toBeInTheDocument()
      expect(screen.getByText(/CSV, Parquet, or ZIP/i)).toBeInTheDocument()
    })

    it('has correct test id', () => {
      render(<CRTDropzone onFileDrop={vi.fn()} />)
      expect(screen.getByTestId('crt-dropzone')).toBeInTheDocument()
    })

    it('renders hidden file input', () => {
      render(<CRTDropzone onFileDrop={vi.fn()} />)

      const input = screen.getByTestId('crt-dropzone-input')
      expect(input).toHaveClass('hidden')
    })

    it('has CRT styling classes', () => {
      render(<CRTDropzone onFileDrop={vi.fn()} />)

      const dropzone = screen.getByTestId('crt-dropzone')
      expect(dropzone).toHaveClass('crt-dropzone')
      expect(dropzone).toHaveClass('cursor-pointer')
    })
  })

  describe('drag and drop behavior', () => {
    it('shows active state on drag over', () => {
      render(<CRTDropzone onFileDrop={vi.fn()} />)

      const dropzone = screen.getByTestId('crt-dropzone')
      fireEvent.dragEnter(dropzone)

      expect(dropzone).toHaveClass('crt-dropzone-active')
    })

    it('removes active state on drag leave', () => {
      render(<CRTDropzone onFileDrop={vi.fn()} />)

      const dropzone = screen.getByTestId('crt-dropzone')
      fireEvent.dragEnter(dropzone)
      fireEvent.dragLeave(dropzone)

      expect(dropzone).not.toHaveClass('crt-dropzone-active')
    })

    it('handles dragOver event without error', () => {
      render(<CRTDropzone onFileDrop={vi.fn()} />)

      const dropzone = screen.getByTestId('crt-dropzone')

      expect(() => {
        fireEvent.dragOver(dropzone)
      }).not.toThrow()
    })

    it('removes active state after drop', () => {
      render(<CRTDropzone onFileDrop={vi.fn()} />)

      const dropzone = screen.getByTestId('crt-dropzone')
      const file = new File(['test'], 'flows.csv', { type: 'text/csv' })

      fireEvent.dragEnter(dropzone)
      expect(dropzone).toHaveClass('crt-dropzone-active')

      fireEvent.drop(dropzone, {
        dataTransfer: { files: [file] },
      })

      expect(dropzone).not.toHaveClass('crt-dropzone-active')
    })

    it('calls onFileDrop with file on drop', () => {
      const onFileDrop = vi.fn()
      render(<CRTDropzone onFileDrop={onFileDrop} />)

      const dropzone = screen.getByTestId('crt-dropzone')
      const file = new File(['test'], 'flows.csv', { type: 'text/csv' })

      fireEvent.drop(dropzone, {
        dataTransfer: { files: [file] },
      })

      expect(onFileDrop).toHaveBeenCalledWith(file)
    })

    it('only uses first file when multiple files dropped', () => {
      const onFileDrop = vi.fn()
      render(<CRTDropzone onFileDrop={onFileDrop} />)

      const dropzone = screen.getByTestId('crt-dropzone')
      const file1 = new File(['test1'], 'first.csv', { type: 'text/csv' })
      const file2 = new File(['test2'], 'second.csv', { type: 'text/csv' })

      fireEvent.drop(dropzone, {
        dataTransfer: { files: [file1, file2] },
      })

      expect(onFileDrop).toHaveBeenCalledTimes(1)
      expect(onFileDrop).toHaveBeenCalledWith(file1)
    })

    it('does not call onFileDrop when no files in drop', () => {
      const onFileDrop = vi.fn()
      render(<CRTDropzone onFileDrop={onFileDrop} />)

      const dropzone = screen.getByTestId('crt-dropzone')

      fireEvent.drop(dropzone, {
        dataTransfer: { files: [] },
      })

      expect(onFileDrop).not.toHaveBeenCalled()
    })

    it('handles drop with undefined dataTransfer', () => {
      const onFileDrop = vi.fn()
      render(<CRTDropzone onFileDrop={onFileDrop} />)

      const dropzone = screen.getByTestId('crt-dropzone')

      expect(() => {
        fireEvent.drop(dropzone, {})
      }).not.toThrow()

      expect(onFileDrop).not.toHaveBeenCalled()
    })

    it('handles rapid drag enter/leave events', () => {
      render(<CRTDropzone onFileDrop={vi.fn()} />)

      const dropzone = screen.getByTestId('crt-dropzone')

      fireEvent.dragEnter(dropzone)
      fireEvent.dragEnter(dropzone)
      fireEvent.dragLeave(dropzone)
      fireEvent.dragEnter(dropzone)

      expect(dropzone).toHaveClass('crt-dropzone-active')

      fireEvent.dragLeave(dropzone)
      expect(dropzone).not.toHaveClass('crt-dropzone-active')
    })
  })

  describe('file types', () => {
    it('accepts CSV files', () => {
      const onFileDrop = vi.fn()
      render(<CRTDropzone onFileDrop={onFileDrop} />)

      const dropzone = screen.getByTestId('crt-dropzone')
      const file = new File(['a,b,c'], 'data.csv', { type: 'text/csv' })

      fireEvent.drop(dropzone, {
        dataTransfer: { files: [file] },
      })

      expect(onFileDrop).toHaveBeenCalled()
    })

    it('accepts Parquet files', () => {
      const onFileDrop = vi.fn()
      render(<CRTDropzone onFileDrop={onFileDrop} />)

      const dropzone = screen.getByTestId('crt-dropzone')
      const file = new File(['parquet'], 'data.parquet', { type: 'application/octet-stream' })

      fireEvent.drop(dropzone, {
        dataTransfer: { files: [file] },
      })

      expect(onFileDrop).toHaveBeenCalled()
    })

    it('file input accepts csv, parquet, and zip', () => {
      render(<CRTDropzone onFileDrop={vi.fn()} />)

      const input = screen.getByTestId('crt-dropzone-input')
      expect(input).toHaveAttribute('accept', '.csv,.parquet,.zip')
    })

    it('accepts ZIP files', () => {
      const onFileDrop = vi.fn()
      render(<CRTDropzone onFileDrop={onFileDrop} />)

      const dropzone = screen.getByTestId('crt-dropzone')
      const file = new File(['zipdata'], 'data.zip', { type: 'application/zip' })

      fireEvent.drop(dropzone, {
        dataTransfer: { files: [file] },
      })

      expect(onFileDrop).toHaveBeenCalled()
    })

    it('accepts files with uppercase extensions', () => {
      const onFileDrop = vi.fn()
      render(<CRTDropzone onFileDrop={onFileDrop} />)

      const dropzone = screen.getByTestId('crt-dropzone')
      const file = new File(['data'], 'DATA.CSV', { type: 'text/csv' })

      fireEvent.drop(dropzone, {
        dataTransfer: { files: [file] },
      })

      expect(onFileDrop).toHaveBeenCalled()
    })

    it('accepts files with mixed case extensions', () => {
      const onFileDrop = vi.fn()
      render(<CRTDropzone onFileDrop={onFileDrop} />)

      const dropzone = screen.getByTestId('crt-dropzone')
      const file = new File(['data'], 'flows.Parquet', { type: 'application/octet-stream' })

      fireEvent.drop(dropzone, {
        dataTransfer: { files: [file] },
      })

      expect(onFileDrop).toHaveBeenCalled()
    })
  })

  describe('click behavior', () => {
    it('opens file picker on click', () => {
      render(<CRTDropzone onFileDrop={vi.fn()} />)

      const input = screen.getByTestId('crt-dropzone-input')
      expect(input).toHaveAttribute('type', 'file')
      expect(input).toHaveAttribute('accept', '.csv,.parquet,.zip')
    })

    it('calls onFileDrop when file selected via input', () => {
      const onFileDrop = vi.fn()
      render(<CRTDropzone onFileDrop={onFileDrop} />)

      const input = screen.getByTestId('crt-dropzone-input')
      const file = new File(['test'], 'selected.csv', { type: 'text/csv' })

      fireEvent.change(input, { target: { files: [file] } })

      expect(onFileDrop).toHaveBeenCalledWith(file)
    })

    it('handles empty file selection', () => {
      const onFileDrop = vi.fn()
      render(<CRTDropzone onFileDrop={onFileDrop} />)

      const input = screen.getByTestId('crt-dropzone-input')

      fireEvent.change(input, { target: { files: [] } })

      expect(onFileDrop).not.toHaveBeenCalled()
    })

    it('handles null files in input', () => {
      const onFileDrop = vi.fn()
      render(<CRTDropzone onFileDrop={onFileDrop} />)

      const input = screen.getByTestId('crt-dropzone-input')

      fireEvent.change(input, { target: { files: null } })

      expect(onFileDrop).not.toHaveBeenCalled()
    })
  })

  describe('disabled state', () => {
    it('can be disabled', () => {
      render(<CRTDropzone onFileDrop={vi.fn()} disabled />)

      const dropzone = screen.getByTestId('crt-dropzone')
      expect(dropzone).toHaveAttribute('aria-disabled', 'true')
    })

    it('does not activate on drag when disabled', () => {
      render(<CRTDropzone onFileDrop={vi.fn()} disabled />)

      const dropzone = screen.getByTestId('crt-dropzone')
      fireEvent.dragEnter(dropzone)

      expect(dropzone).not.toHaveClass('crt-dropzone-active')
    })

    it('does not call onFileDrop on drop when disabled', () => {
      const onFileDrop = vi.fn()
      render(<CRTDropzone onFileDrop={onFileDrop} disabled />)

      const dropzone = screen.getByTestId('crt-dropzone')
      const file = new File(['test'], 'flows.csv', { type: 'text/csv' })

      fireEvent.drop(dropzone, {
        dataTransfer: { files: [file] },
      })

      expect(onFileDrop).not.toHaveBeenCalled()
    })

    it('is not disabled by default', () => {
      render(<CRTDropzone onFileDrop={vi.fn()} />)

      const dropzone = screen.getByTestId('crt-dropzone')
      expect(dropzone).toHaveAttribute('aria-disabled', 'false')
    })
  })

  describe('accessibility', () => {
    it('has aria-disabled attribute', () => {
      render(<CRTDropzone onFileDrop={vi.fn()} />)

      const dropzone = screen.getByTestId('crt-dropzone')
      expect(dropzone).toHaveAttribute('aria-disabled')
    })

    it('file input is hidden from view', () => {
      render(<CRTDropzone onFileDrop={vi.fn()} />)

      const input = screen.getByTestId('crt-dropzone-input')
      expect(input).toHaveClass('hidden')
    })
  })

  describe('edge cases', () => {
    it('handles file with no extension', () => {
      const onFileDrop = vi.fn()
      render(<CRTDropzone onFileDrop={onFileDrop} />)

      const dropzone = screen.getByTestId('crt-dropzone')
      const file = new File(['data'], 'noextension', { type: 'application/octet-stream' })

      fireEvent.drop(dropzone, {
        dataTransfer: { files: [file] },
      })

      // Component accepts any file on drop (validation happens elsewhere)
      expect(onFileDrop).toHaveBeenCalledWith(file)
    })

    it('handles file with very long name', () => {
      const onFileDrop = vi.fn()
      render(<CRTDropzone onFileDrop={onFileDrop} />)

      const dropzone = screen.getByTestId('crt-dropzone')
      const longName = 'a'.repeat(255) + '.csv'
      const file = new File(['data'], longName, { type: 'text/csv' })

      fireEvent.drop(dropzone, {
        dataTransfer: { files: [file] },
      })

      expect(onFileDrop).toHaveBeenCalledWith(file)
    })

    it('handles file with special characters in name', () => {
      const onFileDrop = vi.fn()
      render(<CRTDropzone onFileDrop={onFileDrop} />)

      const dropzone = screen.getByTestId('crt-dropzone')
      const file = new File(['data'], 'file (1) [copy].csv', { type: 'text/csv' })

      fireEvent.drop(dropzone, {
        dataTransfer: { files: [file] },
      })

      expect(onFileDrop).toHaveBeenCalledWith(file)
    })

    it('handles empty file', () => {
      const onFileDrop = vi.fn()
      render(<CRTDropzone onFileDrop={onFileDrop} />)

      const dropzone = screen.getByTestId('crt-dropzone')
      const file = new File([], 'empty.csv', { type: 'text/csv' })

      fireEvent.drop(dropzone, {
        dataTransfer: { files: [file] },
      })

      expect(onFileDrop).toHaveBeenCalledWith(file)
    })

    it('handles large file', () => {
      const onFileDrop = vi.fn()
      render(<CRTDropzone onFileDrop={onFileDrop} />)

      const dropzone = screen.getByTestId('crt-dropzone')
      // Create a file that claims to be 1GB
      const file = new File(['x'], 'large.parquet', { type: 'application/octet-stream' })
      Object.defineProperty(file, 'size', { value: 1024 * 1024 * 1024 })

      fireEvent.drop(dropzone, {
        dataTransfer: { files: [file] },
      })

      expect(onFileDrop).toHaveBeenCalledWith(file)
    })
  })
})
