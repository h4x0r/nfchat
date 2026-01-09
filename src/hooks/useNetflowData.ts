import { useState, useEffect, useCallback } from 'react'
import {
  loadParquetData,
  getTimelineData,
  getAttackDistribution,
  getTopTalkers,
  getFlows,
  getFlowCount,
} from '@/lib/duckdb'
import { useStore } from '@/lib/store'

interface UseNetflowDataResult {
  loading: boolean
  error: string | null
  totalRows: number
  refresh: (whereClause?: string) => Promise<void>
}

export function useNetflowData(parquetUrl: string): UseNetflowDataResult {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [totalRows, setTotalRows] = useState(0)
  const [dataLoaded, setDataLoaded] = useState(false)

  const {
    setTimelineData,
    setAttackBreakdown,
    setTopSrcIPs,
    setTopDstIPs,
    setFlows,
    setTotalFlowCount,
  } = useStore()

  const fetchDashboardData = useCallback(async (whereClause: string = '1=1') => {
    try {
      // Fetch all dashboard data in parallel
      const [timeline, attacks, srcIPs, dstIPs, flows, flowCount] = await Promise.all([
        getTimelineData(60, whereClause),
        getAttackDistribution(),
        getTopTalkers('src', 'flows', 10, whereClause),
        getTopTalkers('dst', 'flows', 10, whereClause),
        getFlows(whereClause, 1000, 0),
        getFlowCount(whereClause),
      ])

      // Update store
      setTimelineData(timeline)
      setAttackBreakdown(attacks)
      setTopSrcIPs(srcIPs.map((t) => ({ ip: t.ip, value: Number(t.value) })))
      setTopDstIPs(dstIPs.map((t) => ({ ip: t.ip, value: Number(t.value) })))
      setFlows(flows)
      setTotalFlowCount(flowCount)
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err)
      throw err
    }
  }, [setTimelineData, setAttackBreakdown, setTopSrcIPs, setTopDstIPs, setFlows, setTotalFlowCount])

  const refresh = useCallback(async (whereClause?: string) => {
    await fetchDashboardData(whereClause || '1=1')
  }, [fetchDashboardData])

  useEffect(() => {
    if (dataLoaded || !parquetUrl) return

    async function loadData() {
      try {
        setLoading(true)
        setError(null)

        // Load parquet file
        const rowCount = await loadParquetData(parquetUrl)
        setTotalRows(rowCount)

        // Fetch initial dashboard data
        await fetchDashboardData()

        setDataLoaded(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [parquetUrl, dataLoaded, fetchDashboardData])

  return {
    loading,
    error,
    totalRows,
    refresh,
  }
}
