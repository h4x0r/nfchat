import { describe, it, expect, beforeEach } from 'vitest'
import { useStore, buildWhereClause, selectFilteredFlows, type FilterState } from './store'

describe('buildWhereClause', () => {
  const emptyFilters: FilterState = {
    timeRange: { start: null, end: null },
    srcIps: [],
    dstIps: [],
    srcPorts: [],
    dstPorts: [],
    protocols: [],
    l7Protocols: [],
    attackTypes: [],
    customFilter: null,
    resultCount: null,
  }

  it('returns 1=1 when no filters are set', () => {
    const result = buildWhereClause(emptyFilters)
    expect(result).toBe('1=1')
  })

  it('filters by time range start', () => {
    const filters: FilterState = {
      ...emptyFilters,
      timeRange: { start: 1424242190000, end: null },
    }
    const result = buildWhereClause(filters)
    expect(result).toBe('FLOW_START_MILLISECONDS >= 1424242190000')
  })

  it('filters by time range end', () => {
    const filters: FilterState = {
      ...emptyFilters,
      timeRange: { start: null, end: 1424242200000 },
    }
    const result = buildWhereClause(filters)
    expect(result).toBe('FLOW_END_MILLISECONDS <= 1424242200000')
  })

  it('filters by both time range start and end', () => {
    const filters: FilterState = {
      ...emptyFilters,
      timeRange: { start: 1424242190000, end: 1424242200000 },
    }
    const result = buildWhereClause(filters)
    expect(result).toContain('FLOW_START_MILLISECONDS >= 1424242190000')
    expect(result).toContain('FLOW_END_MILLISECONDS <= 1424242200000')
    expect(result).toContain(' AND ')
  })

  it('filters by source IPs', () => {
    const filters: FilterState = {
      ...emptyFilters,
      srcIps: ['59.166.0.2', '59.166.0.4'],
    }
    const result = buildWhereClause(filters)
    expect(result).toBe("IPV4_SRC_ADDR IN ('59.166.0.2', '59.166.0.4')")
  })

  it('filters by destination IPs', () => {
    const filters: FilterState = {
      ...emptyFilters,
      dstIps: ['149.171.126.3'],
    }
    const result = buildWhereClause(filters)
    expect(result).toBe("IPV4_DST_ADDR IN ('149.171.126.3')")
  })

  it('filters by attack types', () => {
    const filters: FilterState = {
      ...emptyFilters,
      attackTypes: ['Exploits', 'Reconnaissance'],
    }
    const result = buildWhereClause(filters)
    expect(result).toBe("Attack IN ('Exploits', 'Reconnaissance')")
  })

  it('filters by protocols', () => {
    const filters: FilterState = {
      ...emptyFilters,
      protocols: [6, 17],
    }
    const result = buildWhereClause(filters)
    expect(result).toBe('PROTOCOL IN (6, 17)')
  })

  it('filters by L7 protocols', () => {
    const filters: FilterState = {
      ...emptyFilters,
      l7Protocols: [5, 7],
    }
    const result = buildWhereClause(filters)
    expect(result).toBe('L7_PROTO IN (5, 7)')
  })

  it('includes custom filter in parentheses', () => {
    const filters: FilterState = {
      ...emptyFilters,
      customFilter: "IN_BYTES > 1024 AND L7_PROTO = 5",
    }
    const result = buildWhereClause(filters)
    expect(result).toBe("(IN_BYTES > 1024 AND L7_PROTO = 5)")
  })

  it('combines multiple filters with AND', () => {
    const filters: FilterState = {
      ...emptyFilters,
      srcIps: ['59.166.0.2'],
      attackTypes: ['Exploits'],
      protocols: [6],
    }
    const result = buildWhereClause(filters)
    expect(result).toContain("IPV4_SRC_ADDR IN ('59.166.0.2')")
    expect(result).toContain("Attack IN ('Exploits')")
    expect(result).toContain('PROTOCOL IN (6)')
    expect(result.split(' AND ').length).toBe(3)
  })
})

describe('useStore', () => {
  beforeEach(() => {
    // Reset store before each test
    useStore.setState({
      timeRange: { start: null, end: null },
      srcIps: [],
      dstIps: [],
      srcPorts: [],
      dstPorts: [],
      protocols: [],
      l7Protocols: [],
      attackTypes: [],
      customFilter: null,
      resultCount: null,
      messages: [],
      isLoading: false,
      dataLoaded: false,
      dataLoading: false,
      dataError: null,
      totalRows: 0,
    })
  })

  it('adds source IP without duplicates', () => {
    const { addSrcIp } = useStore.getState()

    addSrcIp('59.166.0.2')
    expect(useStore.getState().srcIps).toEqual(['59.166.0.2'])

    addSrcIp('59.166.0.2') // duplicate
    expect(useStore.getState().srcIps).toEqual(['59.166.0.2'])

    addSrcIp('59.166.0.4')
    expect(useStore.getState().srcIps).toEqual(['59.166.0.2', '59.166.0.4'])
  })

  it('removes source IP', () => {
    useStore.setState({ srcIps: ['59.166.0.2', '59.166.0.4'] })
    const { removeSrcIp } = useStore.getState()

    removeSrcIp('59.166.0.2')
    expect(useStore.getState().srcIps).toEqual(['59.166.0.4'])
  })

  it('toggles attack type', () => {
    const { toggleAttackType } = useStore.getState()

    toggleAttackType('Exploits')
    expect(useStore.getState().attackTypes).toEqual(['Exploits'])

    toggleAttackType('Reconnaissance')
    expect(useStore.getState().attackTypes).toEqual(['Exploits', 'Reconnaissance'])

    toggleAttackType('Exploits') // toggle off
    expect(useStore.getState().attackTypes).toEqual(['Reconnaissance'])
  })

  it('sets time range', () => {
    const { setTimeRange } = useStore.getState()

    setTimeRange(1424242190000, 1424242200000)
    expect(useStore.getState().timeRange).toEqual({
      start: 1424242190000,
      end: 1424242200000,
    })
  })

  it('clears all filters', () => {
    useStore.setState({
      srcIps: ['59.166.0.2'],
      attackTypes: ['Exploits'],
      customFilter: 'test',
    })

    const { clearFilters } = useStore.getState()
    clearFilters()

    const state = useStore.getState()
    expect(state.srcIps).toEqual([])
    expect(state.attackTypes).toEqual([])
    expect(state.customFilter).toBeNull()
  })

  it('adds chat message with generated id and timestamp', () => {
    const { addMessage } = useStore.getState()

    addMessage({ role: 'user', content: 'Show me attacks' })

    const messages = useStore.getState().messages
    expect(messages).toHaveLength(1)
    expect(messages[0].role).toBe('user')
    expect(messages[0].content).toBe('Show me attacks')
    expect(messages[0].id).toBeDefined()
    expect(messages[0].timestamp).toBeInstanceOf(Date)
  })

  describe('hideBenign filter', () => {
    it('defaults to false', () => {
      expect(useStore.getState().hideBenign).toBe(false)
    })

    it('toggles hideBenign state', () => {
      const { toggleHideBenign } = useStore.getState()

      toggleHideBenign()
      expect(useStore.getState().hideBenign).toBe(true)

      toggleHideBenign()
      expect(useStore.getState().hideBenign).toBe(false)
    })

    it('filters flows when hideBenign is true', () => {
      const mockFlows = [
        { Attack: 'Benign', IPV4_SRC_ADDR: '1.1.1.1' },
        { Attack: 'Backdoor', IPV4_SRC_ADDR: '2.2.2.2' },
        { Attack: 'Benign', IPV4_SRC_ADDR: '3.3.3.3' },
        { Attack: 'Exploits', IPV4_SRC_ADDR: '4.4.4.4' },
      ]

      useStore.setState({ flows: mockFlows, hideBenign: false })
      expect(selectFilteredFlows(useStore.getState())).toHaveLength(4)

      useStore.setState({ hideBenign: true })
      const filtered = selectFilteredFlows(useStore.getState())
      expect(filtered).toHaveLength(2)
      expect(filtered.every((f) => f.Attack !== 'Benign')).toBe(true)
    })

    it('returns all flows when hideBenign is false', () => {
      const mockFlows = [
        { Attack: 'Benign', IPV4_SRC_ADDR: '1.1.1.1' },
        { Attack: 'Backdoor', IPV4_SRC_ADDR: '2.2.2.2' },
      ]

      useStore.setState({ flows: mockFlows, hideBenign: false })
      expect(selectFilteredFlows(useStore.getState())).toHaveLength(2)
    })
  })
})
