import { useState, useEffect, useCallback, useMemo } from 'react'
import { loadDataFromUrl, getDashboardData, uploadFile, cleanupUpload } from '@/lib/api-client'
import { useStore } from '@/lib/store'
import type { ProgressEvent, LogEntry } from '@/lib/progress'

export type DataSource = string | { type: 'file'; file: File }

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

export function useNetflowData(source: DataSource): UseNetflowDataResult {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [totalRows, setTotalRows] = useState(0)
  const [dataLoaded, setDataLoaded] = useState(false)
  const [progress, setProgress] = useState<ProgressEvent>(initialProgress)
  const [logs, setLogs] = useState<LogEntry[]>([])

  const {
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
        message: 'Fetching dashboard data from server',
        timestamp: Date.now(),
      })

      // Fetch all dashboard data from server-side MotherDuck
      // Start with 100 flows for fast initial load, user can load more
      const data = await getDashboardData({
        bucketMinutes: 60,
        whereClause,
        limit: 100,
        offset: 0,
      })

      // Update store with all data (timeline removed in forensic dashboard redesign)
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
  }, [setAttackBreakdown, setTopSrcIPs, setTopDstIPs, setFlows, setTotalFlowCount, addLog])

  const refresh = useCallback(async (whereClause?: string) => {
    await fetchDashboardData(whereClause || '1=1')
  }, [fetchDashboardData])

  // Stable dependency key for file sources to prevent re-triggering
  const sourceKey = useMemo(() => {
    if (typeof source === 'string') return source
    return `file:${source.file.name}:${source.file.size}:${source.file.lastModified}`
  }, [source])

  // Determine if there's a source to load
  const hasSource = typeof source === 'string' ? source.length > 0 : true

  useEffect(() => {
    if (dataLoaded || !hasSource) return

    async function loadData() {
      const keysToCleanup: string[] = []

      try {
        setLoading(true)
        setError(null)
        setLogs([])

        let loadUrl: string

        if (typeof source !== 'string') {
          // File source: upload to R2 first, then load from R2
          addLog({
            level: 'info',
            message: `Uploading ${source.file.name}...`,
            timestamp: Date.now(),
          })

          const uploadResult = await uploadFile(source.file, {
            onProgress: setProgress,
            onLog: addLog,
          })

          loadUrl = uploadResult.url
          keysToCleanup.push(uploadResult.key)
        } else {
          loadUrl = source
        }

        // Load data via server-side API (chunked for large datasets)
        const result = await loadDataFromUrl(loadUrl, {
          onProgress: setProgress,
          onLog: addLog,
        })
        setTotalRows(result.rowCount ?? 0)

        // Fetch all dashboard data
        await fetchDashboardData('1=1')

        // Complete
        setProgress({
          stage: 'complete',
          percent: 100,
          message: `Ready - ${(result.rowCount ?? 0).toLocaleString()} flows loaded`,
          timestamp: Date.now(),
        })
        addLog({
          level: 'info',
          message: `Dashboard ready with ${(result.rowCount ?? 0).toLocaleString()} flows`,
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
        // Clean up temp files regardless of success/failure
        if (keysToCleanup.length > 0) {
          cleanupUpload(keysToCleanup).catch((err) => {
            console.error('Failed to cleanup temp files:', err)
          })
        }
      }
    }

    loadData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceKey, dataLoaded, fetchDashboardData, addLog, hasSource])

  return {
    loading,
    error,
    totalRows,
    progress,
    logs,
    refresh,
  }
}
