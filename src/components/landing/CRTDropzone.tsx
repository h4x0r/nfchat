import { useState, useRef, useCallback } from 'react'
import '@/styles/crt.css'

interface CRTDropzoneProps {
  onFileDrop: (file: File) => void
  disabled?: boolean
}

export function CRTDropzone({ onFileDrop, disabled = false }: CRTDropzoneProps) {
  const [isDragActive, setIsDragActive] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled) {
      setIsDragActive(true)
    }
  }, [disabled])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(false)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(false)

    if (disabled) return

    const files = e.dataTransfer?.files
    if (files && files.length > 0) {
      onFileDrop(files[0])
    }
  }, [disabled, onFileDrop])

  const handleClick = useCallback(() => {
    if (!disabled) {
      inputRef.current?.click()
    }
  }, [disabled])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      onFileDrop(files[0])
    }
  }, [onFileDrop])

  return (
    <div
      data-testid="crt-dropzone"
      className={`crt-dropzone p-8 text-center cursor-pointer ${
        isDragActive ? 'crt-dropzone-active' : ''
      }`}
      onClick={handleClick}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      aria-disabled={disabled}
    >
      <input
        ref={inputRef}
        data-testid="crt-dropzone-input"
        type="file"
        accept=".csv,.parquet"
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="crt-glow text-lg mb-2">
        DROP FILE HERE
      </div>
      <div className="crt-glow-dim text-sm">
        csv, parquet
      </div>
    </div>
  )
}
