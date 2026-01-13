import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useContainerDimensions } from './useContainerDimensions'

describe('useContainerDimensions', () => {
  // Use explicit function types to avoid vi.fn() type issues
  let mockObserve: (el: Element) => void
  let mockUnobserve: (el: Element) => void
  let mockDisconnect: () => void
  let observerCallbacks: ResizeObserverCallback[] = []

  beforeEach(() => {
    mockObserve = vi.fn()
    mockUnobserve = vi.fn()
    mockDisconnect = vi.fn()
    observerCallbacks = []

    // Capture mock references for use inside class
    const observeFn = mockObserve
    const unobserveFn = mockUnobserve
    const disconnectFn = mockDisconnect

    // Mock ResizeObserver - creates new instance each time
    global.ResizeObserver = class MockResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        observerCallbacks.push(callback)
      }

      observe(element: Element) {
        observeFn(element)
      }

      unobserve(element: Element) {
        unobserveFn(element)
      }

      disconnect() {
        disconnectFn()
      }
    } as unknown as typeof ResizeObserver
  })

  afterEach(() => {
    vi.restoreAllMocks()
    observerCallbacks = []
  })

  it('returns initial state with dimensions at 0 and not ready', () => {
    const { result } = renderHook(() => useContainerDimensions())

    expect(result.current.width).toBe(0)
    expect(result.current.height).toBe(0)
    expect(result.current.isReady).toBe(false)
  })

  it('returns a ref that can be attached to an element', () => {
    const { result } = renderHook(() => useContainerDimensions())

    expect(result.current.ref).toBeDefined()
    expect(typeof result.current.ref).toBe('object')
  })

  it('returns a setRef callback for ref sharing', () => {
    const { result } = renderHook(() => useContainerDimensions())

    expect(result.current.setRef).toBeDefined()
    expect(typeof result.current.setRef).toBe('function')
  })

  it('reports isReady as false when dimensions are 0', () => {
    const { result } = renderHook(() => useContainerDimensions())

    // Initial state should be not ready (0, 0)
    expect(result.current.isReady).toBe(false)
    expect(result.current.width).toBe(0)
    expect(result.current.height).toBe(0)
  })

  it('reports isReady correctly with custom thresholds', () => {
    const { result } = renderHook(() =>
      useContainerDimensions({ minWidth: 100, minHeight: 100 })
    )

    // Initial state with 0 dimensions should not be ready
    expect(result.current.isReady).toBe(false)
  })

  it('accepts minWidth and minHeight options', () => {
    // Should not throw with options
    const { result } = renderHook(() =>
      useContainerDimensions({ minWidth: 50, minHeight: 50 })
    )

    expect(result.current).toBeDefined()
    expect(result.current.isReady).toBe(false)
  })

  it('exports correct interface', () => {
    const { result } = renderHook(() => useContainerDimensions())

    // Verify all expected properties exist
    expect(result.current).toHaveProperty('width')
    expect(result.current).toHaveProperty('height')
    expect(result.current).toHaveProperty('isReady')
    expect(result.current).toHaveProperty('ref')
    expect(result.current).toHaveProperty('setRef')

    // Verify types
    expect(typeof result.current.width).toBe('number')
    expect(typeof result.current.height).toBe('number')
    expect(typeof result.current.isReady).toBe('boolean')
    expect(result.current.ref).toBeDefined()
    expect(typeof result.current.setRef).toBe('function')
  })

  it('uses default threshold of 1 for minWidth and minHeight', () => {
    const { result } = renderHook(() => useContainerDimensions())

    // With 0 dimensions, should not be ready (threshold is 1)
    expect(result.current.isReady).toBe(false)
  })

  it('sets up ResizeObserver when setRef is called with element', () => {
    const { result } = renderHook(() => useContainerDimensions())

    const mockElement = document.createElement('div')

    act(() => {
      result.current.setRef(mockElement)
    })

    expect(mockObserve).toHaveBeenCalledWith(mockElement)
  })

  it('updates dimensions when ResizeObserver fires', () => {
    const { result } = renderHook(() => useContainerDimensions())

    const mockElement = document.createElement('div')

    act(() => {
      result.current.setRef(mockElement)
    })

    // Get the callback that was registered
    const callback = observerCallbacks[0]

    // Simulate ResizeObserver callback
    act(() => {
      callback(
        [
          {
            contentRect: { width: 800, height: 400 } as DOMRectReadOnly,
            target: mockElement,
            borderBoxSize: [],
            contentBoxSize: [],
            devicePixelContentBoxSize: [],
          },
        ],
        {} as ResizeObserver
      )
    })

    expect(result.current.width).toBe(800)
    expect(result.current.height).toBe(400)
    expect(result.current.isReady).toBe(true)
  })

  it('disconnects previous observer when setRef is called with new element', () => {
    const { result } = renderHook(() => useContainerDimensions())

    const mockElement1 = document.createElement('div')
    const mockElement2 = document.createElement('div')

    act(() => {
      result.current.setRef(mockElement1)
    })

    act(() => {
      result.current.setRef(mockElement2)
    })

    // First observer should be disconnected
    expect(mockDisconnect).toHaveBeenCalled()
  })

  it('disconnects observer when setRef is called with null', () => {
    const { result } = renderHook(() => useContainerDimensions())

    const mockElement = document.createElement('div')

    act(() => {
      result.current.setRef(mockElement)
    })

    act(() => {
      result.current.setRef(null)
    })

    expect(mockDisconnect).toHaveBeenCalled()
  })
})
