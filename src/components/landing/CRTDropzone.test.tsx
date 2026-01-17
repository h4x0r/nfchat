import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CRTDropzone } from './CRTDropzone'

describe('CRTDropzone', () => {
  it('renders dropzone with prompt text', () => {
    render(<CRTDropzone onFileDrop={vi.fn()} />)

    expect(screen.getByText(/drop file here/i)).toBeInTheDocument()
    expect(screen.getByText(/csv, parquet/i)).toBeInTheDocument()
  })

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

  it('opens file picker on click', () => {
    render(<CRTDropzone onFileDrop={vi.fn()} />)

    const input = screen.getByTestId('crt-dropzone-input')
    expect(input).toHaveAttribute('type', 'file')
    expect(input).toHaveAttribute('accept', '.csv,.parquet')
  })

  it('can be disabled', () => {
    render(<CRTDropzone onFileDrop={vi.fn()} disabled />)

    const dropzone = screen.getByTestId('crt-dropzone')
    expect(dropzone).toHaveAttribute('aria-disabled', 'true')
  })
})
