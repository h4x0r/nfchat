import { useState, useEffect, RefObject } from 'react'

// Constants for row height calculation
const ROW_HEIGHT = 35 // pixels per row (matches virtualizer estimateSize)
const HEADER_HEIGHT = 80 // table headers + filter row
const PAGINATION_HEIGHT = 40 // pagination controls
const MIN_ROWS = 10
const MAX_ROWS = 100

/**
 * Calculates optimal page size based on container height.
 * Returns number of rows that fit in the available space.
 */
export function useTablePageSize(
  containerRef: RefObject<HTMLDivElement> | null
): number {
  const [pageSize, setPageSize] = useState(MIN_ROWS)

  useEffect(() => {
    if (!containerRef?.current) {
      setPageSize(MIN_ROWS)
      return
    }

    const calculatePageSize = () => {
      const containerHeight = containerRef.current?.clientHeight ?? 0
      const availableHeight = containerHeight - HEADER_HEIGHT - PAGINATION_HEIGHT
      const calculatedRows = Math.floor(availableHeight / ROW_HEIGHT)

      // Clamp between min and max
      const clampedRows = Math.max(MIN_ROWS, Math.min(MAX_ROWS, calculatedRows))
      setPageSize(clampedRows)
    }

    // Initial calculation
    calculatePageSize()

    // Recalculate on resize
    const resizeObserver = new ResizeObserver(calculatePageSize)
    resizeObserver.observe(containerRef.current)

    return () => {
      resizeObserver.disconnect()
    }
  }, [containerRef])

  return pageSize
}
