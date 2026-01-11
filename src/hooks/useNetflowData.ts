import { useState, useEffect, useCallback } from 'react'
import { loadDataFromUrl, getDashboardData } from '@/lib/api-client'
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
        percent: 96,
        message: 'Loading dashboard data...',
        timestamp: Date.now(),
      })
      addLog({
        level: 'info',
        message: 'Fetching dashboard data from server',
        timestamp: Date.now(),
      })

      const data = await getDashboardData({ whereClause })

      // Update store with all data
      setTimelineData(data.timeline)
      setAttackBreakdown(data.attacks)
      setTopSrcIPs(data.topSrcIPs.map((t) => ({ ip: t.ip, value: Number(t.value) })))
      setTopDstIPs(data.topDstIPs.map((t) => ({ ip: t.ip, value: Number(t.value) })))
      setFlows(data.flows)
      setTotalFlowCount(data.totalCount)

      addLog({
        level: 'info',
        message: `Dashboard loaded: ${data.totalCount.toLocaleString()} flows`,
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

        // Load parquet via backend API with progress tracking
        const result = await loadDataFromUrl(parquetUrl, {
          onProgress: setProgress,
          onLog: addLog,
        })
        const rowCount = result.rowCount ?? 0
        setTotalRows(rowCount)

        // Fetch all dashboard data in one API call
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
