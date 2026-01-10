/**
 * FileUploader - Local file picker for data files
 *
 * Features:
 * - Drag and drop support
 * - File validation (.parquet, .csv, .zip)
 * - No server required - loads directly into browser
 */

import { useState, useRef, useCallback } from 'react'

const SUPPORTED_EXTENSIONS = ['.parquet', '.csv', '.zip']

export type FileType = 'parquet' | 'csv' | 'zip'

export interface FileUploaderProps {
  onFileSelect: (file: File, fileType: FileType) => void
  isLoading?: boolean
}

function getFileType(filename: string): FileType | null {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.parquet')) return 'parquet'
  if (lower.endsWith('.csv')) return 'csv'
  if (lower.endsWith('.zip')) return 'zip'
  return null
}

export function FileUploader({ onFileSelect, isLoading = false }: FileUploaderProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [fileType, setFileType] = useState<FileType | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const validateFile = (file: File): boolean => {
    const type = getFileType(file.name)
    if (!type) {
      setError(`Unsupported file type. Please select a ${SUPPORTED_EXTENSIONS.join(', ')} file.`)
      setSelectedFile(null)
      setFileType(null)
      return false
    }
    setError(null)
    setFileType(type)
    return true
  }

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (validateFile(file)) {
      setSelectedFile(file)
    }
  }, [])

  const handleLoad = useCallback(() => {
    if (selectedFile && fileType) {
      onFileSelect(selectedFile, fileType)
    }
  }, [selectedFile, fileType, onFileSelect])

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDragOver(false)

    const file = event.dataTransfer.files?.[0]
    if (!file) return

    if (validateFile(file)) {
      setSelectedFile(file)
    }
  }, [])

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDragOver(false)
  }, [])

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div data-testid="uploader" className="w-full">
      {/* Drag and Drop Zone */}
      <div
        data-testid="drop-zone"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
                   transition-all duration-200
                   ${isDragOver
                     ? 'border-primary bg-primary/10'
                     : 'border-primary/50 hover:border-primary hover:bg-primary/5'}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          data-testid="file-input"
          accept=".parquet,.csv,.zip"
          onChange={handleFileSelect}
          className="hidden"
        />

        <div className="text-primary mb-2">
          <svg
            className="w-12 h-12 mx-auto"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
        </div>

        <p className="text-foreground font-medium">
          Drag & Drop or Click to Select
        </p>
        <p className="text-muted-foreground text-sm mt-1">
          Supported: .parquet, .csv, .zip
        </p>
      </div>

      {/* Selected File Info */}
      {selectedFile && (
        <div className="mt-4 p-3 bg-primary/10 border border-primary/30 rounded-lg">
          <p className="text-foreground text-sm">
            <span className="text-muted-foreground">File:</span> {selectedFile.name}
          </p>
          <p className="text-foreground text-sm">
            <span className="text-muted-foreground">Size:</span> {formatFileSize(selectedFile.size)}
          </p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div
          data-testid="error-message"
          className="mt-4 p-3 bg-destructive/10 border border-destructive/50 rounded-lg"
        >
          <p className="text-destructive text-sm">{error}</p>
        </div>
      )}

      {/* Load Button */}
      <button
        onClick={handleLoad}
        disabled={isLoading || !selectedFile}
        className="mt-4 w-full py-3 px-4 bg-primary text-primary-foreground rounded-lg
                   font-medium hover:bg-primary/90 transition-all duration-200
                   disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? 'Loading...' : 'Load File'}
      </button>
    </div>
  )
}
