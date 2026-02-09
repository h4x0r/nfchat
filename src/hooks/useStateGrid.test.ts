import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useStateGrid } from './useStateGrid'
import type { StateProfile } from '@/lib/store/types'

const mockStates: StateProfile[] = [
  {
    stateId: 0,
    flowCount: 500,
    avgInBytes: 1024,
    avgOutBytes: 512,
    bytesRatio: 2.0,
    avgDurationMs: 2000,
    avgPktsPerSec: 5,
    protocolDist: { tcp: 0.8, udp: 0.15, icmp: 0.05 },
    portCategoryDist: { wellKnown: 0.5, registered: 0.3, ephemeral: 0.2 },
  },
  {
    stateId: 1,
    flowCount: 300,
    avgInBytes: 200,
    avgOutBytes: 100,
    bytesRatio: 2.0,
    avgDurationMs: 500,
    avgPktsPerSec: 20,
    protocolDist: { tcp: 0.6, udp: 0.3, icmp: 0.1 },
    portCategoryDist: { wellKnown: 0.7, registered: 0.2, ephemeral: 0.1 },
  },
  {
    stateId: 2,
    flowCount: 100,
    avgInBytes: 4096,
    avgOutBytes: 2048,
    bytesRatio: 2.0,
    avgDurationMs: 10000,
    avgPktsPerSec: 1,
    protocolDist: { tcp: 0.9, udp: 0.08, icmp: 0.02 },
    portCategoryDist: { wellKnown: 0.8, registered: 0.15, ephemeral: 0.05 },
  },
]

describe('useStateGrid', () => {
  describe('sort', () => {
    it('sorts by flowCount descending by default', () => {
      const { result } = renderHook(() => useStateGrid(mockStates, {}))
      const ids = result.current.filteredAndSortedStates.map((s) => s.stateId)
      expect(ids).toEqual([0, 1, 2]) // 500, 300, 100
    })

    it('sorts by flowCount ascending when toggled', () => {
      const { result } = renderHook(() => useStateGrid(mockStates, {}))
      act(() => result.current.toggleSortDirection())
      const ids = result.current.filteredAndSortedStates.map((s) => s.stateId)
      expect(ids).toEqual([2, 1, 0]) // 100, 300, 500
    })

    it('sorts by avgBytes', () => {
      const { result } = renderHook(() => useStateGrid(mockStates, {}))
      act(() => result.current.setSortBy('avgBytes'))
      const ids = result.current.filteredAndSortedStates.map((s) => s.stateId)
      // 6144, 1536, 300 → [2, 0, 1]
      expect(ids).toEqual([2, 0, 1])
    })

    it('sorts by avgDuration', () => {
      const { result } = renderHook(() => useStateGrid(mockStates, {}))
      act(() => result.current.setSortBy('avgDuration'))
      const ids = result.current.filteredAndSortedStates.map((s) => s.stateId)
      // 10000, 2000, 500 → [2, 0, 1]
      expect(ids).toEqual([2, 0, 1])
    })

    it('sorts by pktsPerSec', () => {
      const { result } = renderHook(() => useStateGrid(mockStates, {}))
      act(() => result.current.setSortBy('pktsPerSec'))
      const ids = result.current.filteredAndSortedStates.map((s) => s.stateId)
      // 20, 5, 1 → [1, 0, 2]
      expect(ids).toEqual([1, 0, 2])
    })

    it('sorts by bytesRatio descending', () => {
      const { result } = renderHook(() => useStateGrid(mockStates, {}))
      act(() => result.current.setSortBy('bytesRatio'))
      const ids = result.current.filteredAndSortedStates.map((s) => s.stateId)
      // All have bytesRatio=2.0, so stable sort maintains original order [0, 1, 2]
      expect(ids).toEqual([0, 1, 2])
    })

    it('double toggle returns to desc', () => {
      const { result } = renderHook(() => useStateGrid(mockStates, {}))
      act(() => result.current.toggleSortDirection())
      act(() => result.current.toggleSortDirection())
      expect(result.current.sortDirection).toBe('desc')
      const ids = result.current.filteredAndSortedStates.map((s) => s.stateId)
      expect(ids).toEqual([0, 1, 2]) // Back to 500, 300, 100
    })

    it('sort is stable for equal values', () => {
      // Create states with same flowCount to test stable sort
      const equalFlowStates: StateProfile[] = [
        { ...mockStates[0], flowCount: 500, stateId: 10 },
        { ...mockStates[1], flowCount: 500, stateId: 11 },
        { ...mockStates[2], flowCount: 500, stateId: 12 },
      ]
      const { result } = renderHook(() => useStateGrid(equalFlowStates, {}))
      const ids = result.current.filteredAndSortedStates.map((s) => s.stateId)
      // Stable sort preserves input order when values are equal
      expect(ids).toEqual([10, 11, 12])
    })

    it('sorts ascending by avgDuration', () => {
      const { result } = renderHook(() => useStateGrid(mockStates, {}))
      act(() => {
        result.current.setSortBy('avgDuration')
        result.current.toggleSortDirection()
      })
      const ids = result.current.filteredAndSortedStates.map((s) => s.stateId)
      // Ascending: 500, 2000, 10000 → [1, 0, 2]
      expect(ids).toEqual([1, 0, 2])
    })
  })

  describe('filter', () => {
    it('filters by minimum flow count', () => {
      const { result } = renderHook(() => useStateGrid(mockStates, {}))
      act(() => result.current.setMinFlowCount(200))
      expect(result.current.filteredAndSortedStates).toHaveLength(2)
      const ids = result.current.filteredAndSortedStates.map((s) => s.stateId)
      expect(ids).toEqual([0, 1])
    })

    it('filters assigned only', () => {
      const assignments = { 0: 'Exfiltration' }
      const { result } = renderHook(() => useStateGrid(mockStates, assignments))
      act(() => result.current.setTacticFilter('assigned'))
      expect(result.current.filteredAndSortedStates).toHaveLength(1)
      expect(result.current.filteredAndSortedStates[0].stateId).toBe(0)
    })

    it('filters unassigned only', () => {
      const assignments = { 0: 'Exfiltration' }
      const { result } = renderHook(() => useStateGrid(mockStates, assignments))
      act(() => result.current.setTacticFilter('unassigned'))
      expect(result.current.filteredAndSortedStates).toHaveLength(2)
    })

    it('combined filter: min flow + assigned', () => {
      const assignments = { 0: 'Exfiltration', 1: 'Recon' }
      const { result } = renderHook(() => useStateGrid(mockStates, assignments))
      act(() => {
        result.current.setMinFlowCount(200)
        result.current.setTacticFilter('assigned')
      })
      expect(result.current.filteredAndSortedStates).toHaveLength(2)
    })

    it('empty states array returns empty result', () => {
      const { result } = renderHook(() => useStateGrid([], {}))
      expect(result.current.filteredAndSortedStates).toHaveLength(0)
    })

    it('minFlowCount at exact boundary includes state', () => {
      const { result } = renderHook(() => useStateGrid(mockStates, {}))
      act(() => result.current.setMinFlowCount(500))
      expect(result.current.filteredAndSortedStates).toHaveLength(1)
      expect(result.current.filteredAndSortedStates[0].stateId).toBe(0)
      expect(result.current.filteredAndSortedStates[0].flowCount).toBe(500)
    })

    it('minFlowCount higher than all states returns empty', () => {
      const { result } = renderHook(() => useStateGrid(mockStates, {}))
      act(() => result.current.setMinFlowCount(1000))
      expect(result.current.filteredAndSortedStates).toHaveLength(0)
    })

    it('all tactic filters with no assignments returns all for "all", empty for "assigned", all for "unassigned"', () => {
      const { result } = renderHook(() => useStateGrid(mockStates, {}))

      // Default 'all' filter
      expect(result.current.filteredAndSortedStates).toHaveLength(3)

      // 'assigned' filter with no assignments
      act(() => result.current.setTacticFilter('assigned'))
      expect(result.current.filteredAndSortedStates).toHaveLength(0)

      // 'unassigned' filter with no assignments
      act(() => result.current.setTacticFilter('unassigned'))
      expect(result.current.filteredAndSortedStates).toHaveLength(3)
    })

    it('combined sort and filter: sort by avgBytes + minFlowCount=200', () => {
      const { result } = renderHook(() => useStateGrid(mockStates, {}))
      act(() => {
        result.current.setSortBy('avgBytes')
        result.current.setMinFlowCount(200)
      })
      // Filters to states 0 (500) and 1 (300), excludes 2 (100)
      expect(result.current.filteredAndSortedStates).toHaveLength(2)
      const ids = result.current.filteredAndSortedStates.map((s) => s.stateId)
      // State 0: avgBytes = 1536, State 1: avgBytes = 300
      // Descending avgBytes: [0, 1]
      expect(ids).toEqual([0, 1])
    })
  })

  describe('comparison', () => {
    it('starts with null comparison', () => {
      const { result } = renderHook(() => useStateGrid(mockStates, {}))
      expect(result.current.comparisonStates).toBeNull()
    })

    it('first toggle selects first state with placeholder second', () => {
      const { result } = renderHook(() => useStateGrid(mockStates, {}))
      act(() => result.current.toggleCompare(0))
      expect(result.current.comparisonStates).toEqual([0, -1])
    })

    it('second toggle completes comparison pair', () => {
      const { result } = renderHook(() => useStateGrid(mockStates, {}))
      act(() => result.current.toggleCompare(0))
      act(() => result.current.toggleCompare(1))
      expect(result.current.comparisonStates).toEqual([0, 1])
    })

    it('deselect first state clears comparison', () => {
      const { result } = renderHook(() => useStateGrid(mockStates, {}))
      act(() => result.current.toggleCompare(0))
      act(() => result.current.toggleCompare(0))
      expect(result.current.comparisonStates).toBeNull()
    })

    it('deselect second state keeps first with placeholder', () => {
      const { result } = renderHook(() => useStateGrid(mockStates, {}))
      act(() => result.current.toggleCompare(0))
      act(() => result.current.toggleCompare(1))
      act(() => result.current.toggleCompare(1))
      expect(result.current.comparisonStates).toEqual([0, -1])
    })

    it('third state replaces second', () => {
      const { result } = renderHook(() => useStateGrid(mockStates, {}))
      act(() => result.current.toggleCompare(0))
      act(() => result.current.toggleCompare(1))
      act(() => result.current.toggleCompare(2))
      expect(result.current.comparisonStates).toEqual([0, 2])
    })

    it('clearComparison resets to null', () => {
      const { result } = renderHook(() => useStateGrid(mockStates, {}))
      act(() => result.current.toggleCompare(0))
      act(() => result.current.toggleCompare(1))
      act(() => result.current.clearComparison())
      expect(result.current.comparisonStates).toBeNull()
    })

    it('toggling same state twice resets to null', () => {
      const { result } = renderHook(() => useStateGrid(mockStates, {}))
      act(() => result.current.toggleCompare(2))
      expect(result.current.comparisonStates).toEqual([2, -1])
      act(() => result.current.toggleCompare(2))
      expect(result.current.comparisonStates).toBeNull()
    })

    it('comparison with only 1 state in grid still works', () => {
      const singleState = [mockStates[0]]
      const { result } = renderHook(() => useStateGrid(singleState, {}))
      act(() => result.current.toggleCompare(0))
      expect(result.current.comparisonStates).toEqual([0, -1])
      // Can still toggle it off
      act(() => result.current.toggleCompare(0))
      expect(result.current.comparisonStates).toBeNull()
    })

    it('toggling first state when pair is complete clears all', () => {
      const { result } = renderHook(() => useStateGrid(mockStates, {}))
      act(() => result.current.toggleCompare(0))
      act(() => result.current.toggleCompare(1))
      expect(result.current.comparisonStates).toEqual([0, 1])
      // Toggle first state again
      act(() => result.current.toggleCompare(0))
      expect(result.current.comparisonStates).toBeNull()
    })

    it('clearComparison after partial selection (one state picked)', () => {
      const { result } = renderHook(() => useStateGrid(mockStates, {}))
      act(() => result.current.toggleCompare(1))
      expect(result.current.comparisonStates).toEqual([1, -1])
      act(() => result.current.clearComparison())
      expect(result.current.comparisonStates).toBeNull()
    })
  })
})
