import { useState, useRef, useEffect, useCallback } from 'react'

export interface ContainerDimensionsOptions {
  /** Minimum width required to consider container ready (default: 1) */
  minWidth?: number
  /** Minimum height required to consider container ready (default: 1) */
  minHeight?: number
}

export interface ContainerDimensions {
  /** Current width of the container */
  width: number
  /** Current height of the container */
  height: number
  /** Whether the container has positive dimensions meeting thresholds */
  isReady: boolean
  /** Ref to attach to the container element */
  ref: React.RefObject<HTMLDivElement | null>
  /** Callback ref for use with ref-sharing patterns */
  setRef: (element: HTMLDivElement | null) => void
}

/**
 * Hook that tracks container dimensions using ResizeObserver.
 * Returns isReady=true only when the container has positive dimensions
 * meeting the specified thresholds.
 *
 * This is useful for components like Recharts ResponsiveContainer that
 * throw warnings when rendered in containers with 0 dimensions.
 *
 * @param options - Configuration options
 * @returns Container dimensions and ready state
 */
export function useContainerDimensions(
  options: ContainerDimensionsOptions = {}
): ContainerDimensions {
  const { minWidth = 1, minHeight = 1 } = options

  const ref = useRef<HTMLDivElement | null>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const observerRef = useRef<ResizeObserver | null>(null)

  const isReady = dimensions.width >= minWidth && dimensions.height >= minHeight

  // Callback ref that can be used for ref sharing
  const setRef = useCallback((element: HTMLDivElement | null) => {
    // Cleanup previous observer if element changes
    if (observerRef.current) {
      observerRef.current.disconnect()
      observerRef.current = null
    }

    ref.current = element

    if (element) {
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect
          setDimensions({ width, height })
        }
      })
      observer.observe(element)
      observerRef.current = observer
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [])

  return {
    width: dimensions.width,
    height: dimensions.height,
    isReady,
    ref,
    setRef,
  }
}
