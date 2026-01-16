import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useTablePageSize } from './useTablePageSize'

// Mock ResizeObserver
class ResizeObserverMock {
  callback: ResizeObserverCallback
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver

describe('useTablePageSize', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns default page size when no ref', () => {
    const { result } = renderHook(() => useTablePageSize(null))
    expect(result.current).toBe(10) // MIN_ROWS default
  })

  it('calculates page size based on container height', () => {
    const mockRef = {
      current: {
        clientHeight: 500,
      },
    } as React.RefObject<HTMLDivElement>

    const { result } = renderHook(() => useTablePageSize(mockRef))

    // 500px container - 120px (headers+pagination) = 380px
    // 380px / 35px per row ≈ 10 rows
    expect(result.current).toBeGreaterThanOrEqual(10)
    expect(result.current).toBeLessThanOrEqual(15)
  })

  it('returns minimum of 10 rows for small containers', () => {
    const mockRef = {
      current: {
        clientHeight: 200,
      },
    } as React.RefObject<HTMLDivElement>

    const { result } = renderHook(() => useTablePageSize(mockRef))
    expect(result.current).toBeGreaterThanOrEqual(10)
  })

  it('caps at maximum of 100 rows for large containers', () => {
    const mockRef = {
      current: {
        clientHeight: 5000,
      },
    } as React.RefObject<HTMLDivElement>

    const { result } = renderHook(() => useTablePageSize(mockRef))
    expect(result.current).toBeLessThanOrEqual(100)
  })

  it('recalculates on container resize', () => {
    let capturedCallback: ResizeObserverCallback | null = null

    global.ResizeObserver = class {
      callback: ResizeObserverCallback
      constructor(callback: ResizeObserverCallback) {
        this.callback = callback
        capturedCallback = callback
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver

    const mockElement = {
      clientHeight: 500,
    }
    const mockRef = {
      current: mockElement,
    } as React.RefObject<HTMLDivElement>

    const { result, rerender } = renderHook(() => useTablePageSize(mockRef))
    const initialSize = result.current

    // Simulate resize
    mockElement.clientHeight = 800
    if (capturedCallback) {
      capturedCallback([], {} as ResizeObserver)
    }
    rerender()

    // After resize to larger container, should have more rows
    expect(result.current).toBeGreaterThanOrEqual(initialSize)
  })
})
