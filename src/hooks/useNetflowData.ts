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

export interface LoadingProgress {
  stage: string
  percent: number
}

interface UseNetflowDataResult {
  loading: boolean
  error: string | null
  totalRows: number
  progress: LoadingProgress
  refresh: (whereClause?: string) => Promise<void>
}

export function useNetflowData(parquetUrl: string): UseNetflowDataResult {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [totalRows, setTotalRows] = useState(0)
  const [dataLoaded, setDataLoaded] = useState(false)
  const [progress, setProgress] = useState<LoadingProgress>({ stage: '', percent: 0 })

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

    // Small delay to allow React to render progress updates
    const tick = () => new Promise((r) => setTimeout(r, 0))

    async function loadData() {
      try {
        setLoading(true)
        setError(null)

        // Stage 1: Initialize
        setProgress({ stage: 'Initializing DuckDB...', percent: 20 })
        await tick()

        // Stage 2: Load parquet file
        setProgress({ stage: 'Loading data...', percent: 40 })
        await tick()
        const rowCount = await loadParquetData(parquetUrl)
        setTotalRows(rowCount)

        // Stage 3: Build dashboard
        setProgress({ stage: 'Building dashboard...', percent: 70 })
        await tick()
        await fetchDashboardData()

        // Complete
        setProgress({ stage: 'Complete', percent: 100 })
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
    progress,
    refresh,
  }
}
