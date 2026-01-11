/**
 * Progress tracking for data loading operations
 */

export type ProgressStage =
  | 'initializing'
  | 'uploading'
  | 'downloading'
  | 'parsing'
  | 'building'
  | 'complete'
  | 'error'

export interface ProgressEvent {
  stage: ProgressStage
  percent: number
  message: string
  bytesLoaded?: number
  bytesTotal?: number
  timestamp: number
}

export interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
  timestamp: number
}

export type ProgressCallback = (event: ProgressEvent) => void
export type LogCallback = (entry: LogEntry) => void

/**
 * Create a progress tracker that manages state and emits events
 */
export function createProgressTracker(
  onProgress: ProgressCallback,
  onLog?: LogCallback
) {
  const startTime = performance.now()

  const elapsed = () => ((performance.now() - startTime) / 1000).toFixed(3)

  const emit = (stage: ProgressStage, percent: number, message: string, extra?: Partial<ProgressEvent>) => {
    onProgress({
      stage,
      percent,
      message,
      timestamp: Date.now(),
      ...extra,
    })
  }

  const log = (level: LogEntry['level'], message: string) => {
    const entry: LogEntry = {
      level,
      message: `[${elapsed()}s] ${message}`,
      timestamp: Date.now(),
    }
    onLog?.(entry)
  }

  return {
    emit,
    log,
    elapsed,
  }
}

/**
 * Fetch with progress tracking using ReadableStream
 * Progress updates are throttled to max 10/second to avoid overwhelming React
 */
export async function fetchWithProgress(
  url: string,
  onProgress: (loaded: number, total: number) => void
): Promise<ArrayBuffer> {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }

  const contentLength = response.headers.get('content-length')
  const total = contentLength ? parseInt(contentLength, 10) : 0

  if (!response.body) {
    // Fallback for browsers without ReadableStream support
    return response.arrayBuffer()
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let loaded = 0

  // Throttle progress updates to max 10/second
  let lastProgressTime = 0
  const THROTTLE_MS = 100

  while (true) {
    const { done, value } = await reader.read()

    if (done) break

    chunks.push(value)
    loaded += value.length

    // Throttle progress updates
    const now = performance.now()
    if (now - lastProgressTime >= THROTTLE_MS) {
      onProgress(loaded, total)
      lastProgressTime = now
    }
  }

  // Always emit final progress
  onProgress(loaded, total)

  // Combine chunks into single ArrayBuffer (clears chunks for GC)
  return combineChunks(chunks, loaded)
}

/**
 * Format bytes as human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/**
 * Combine multiple Uint8Array chunks into a single ArrayBuffer.
 * IMPORTANT: Clears the input chunks array to allow garbage collection
 * of individual chunks, reducing peak memory usage.
 */
export function combineChunks(chunks: Uint8Array[], totalSize: number): ArrayBuffer {
  const combined = new Uint8Array(totalSize)
  let offset = 0
  for (const chunk of chunks) {
    combined.set(chunk, offset)
    offset += chunk.length
  }
  // Clear chunks array to release references and allow GC
  chunks.length = 0
  return combined.buffer
}
