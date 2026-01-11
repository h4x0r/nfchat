import { useState, useEffect, useCallback } from 'react'
import {
  loadParquetData,
  getTimelineData,
  getAttackDistribution,
  getTopTalkers,
  getFlows,
  getFlowCount,
} from '@/lib/motherduck'
import { useStore } from '@/lib/store'
import type { ProgressEvent, LogEntry } from '@/lib/progress'

interface UseNetflowDataResult {
  loading: boolean
  error: string | null
  totalRows: number
  progress: ProgressEvent
  logs: LogEntry[]
  refresh: (whereClause?: string) => Promise<void>
}

const initialProgress: ProgressEvent = {
  stage: 'initializing',
  percent: 0,
  message: '',
  timestamp: Date.now(),
}

export function useNetflowData(parquetUrl: string): UseNetflowDataResult {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [totalRows, setTotalRows] = useState(0)
  const [dataLoaded, setDataLoaded] = useState(false)
  const [progress, setProgress] = useState<ProgressEvent>(initialProgress)
  const [logs, setLogs] = useState<LogEntry[]>([])

  const {
    setTimelineData,
    setAttackBreakdown,
    setTopSrcIPs,
    setTopDstIPs,
    setFlows,
    setTotalFlowCount,
  } = useStore()

  const addLog = useCallback((entry: LogEntry) => {
    setLogs((prev) => [...prev, entry])
  }, [])

  const fetchDashboardData = useCallback(async (whereClause: string = '1=1') => {
    try {
      setProgress({
        stage: 'building',
        percent: 80,
        message: 'Building dashboard...',
        timestamp: Date.now(),
      })
      addLog({
        level: 'info',
        message: 'Querying MotherDuck for dashboard data',
        timestamp: Date.now(),
      })

      // Fetch all dashboard data in parallel from browser-side MotherDuck
      const [timeline, attacks, srcIPs, dstIPs, flows, flowCount] = await Promise.all([
        getTimelineData(60, whereClause),
        getAttackDistribution(),
        getTopTalkers('src', 'flows', 10, whereClause),
        getTopTalkers('dst', 'flows', 10, whereClause),
        getFlows(whereClause, 1000, 0),
        getFlowCount(whereClause),
      ])

      // Update store with all data
      setTimelineData(timeline)
      setAttackBreakdown(attacks)
      setTopSrcIPs(srcIPs.map((t) => ({ ip: t.ip, value: Number(t.value) })))
      setTopDstIPs(dstIPs.map((t) => ({ ip: t.ip, value: Number(t.value) })))
      setFlows(flows)
      setTotalFlowCount(flowCount)

      addLog({
        level: 'info',
        message: `Dashboard loaded: ${flowCount.toLocaleString()} flows`,
        timestamp: Date.now(),
      })
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err)
      throw err
    }
  }, [setTimelineData, setAttackBreakdown, setTopSrcIPs, setTopDstIPs, setFlows, setTotalFlowCount, addLog])

  const refresh = useCallback(async (whereClause?: string) => {
    await fetchDashboardData(whereClause || '1=1')
  }, [fetchDashboardData])

  useEffect(() => {
    if (dataLoaded || !parquetUrl) return

    async function loadData() {
      try {
        setLoading(true)
        setError(null)
        setLogs([])

        // Load parquet via browser-side MotherDuck WASM client
        const rowCount = await loadParquetData(parquetUrl, {
          onProgress: setProgress,
          onLog: addLog,
        })
        setTotalRows(rowCount)

        // Fetch all dashboard data
        await fetchDashboardData('1=1')

        // Complete
        setProgress({
          stage: 'complete',
          percent: 100,
          message: `Ready - ${rowCount.toLocaleString()} flows loaded`,
          timestamp: Date.now(),
        })
        addLog({
          level: 'info',
          message: `Dashboard ready with ${rowCount.toLocaleString()} flows`,
          timestamp: Date.now(),
        })
        setDataLoaded(true)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        setError(message)
        setProgress({
          stage: 'error',
          percent: 0,
          message,
          timestamp: Date.now(),
        })
        addLog({
          level: 'error',
          message: `Error: ${message}`,
          timestamp: Date.now(),
        })
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [parquetUrl, dataLoaded, fetchDashboardData, addLog])

  return {
    loading,
    error,
    totalRows,
    progress,
    logs,
    refresh,
  }
}
