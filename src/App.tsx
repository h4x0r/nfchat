import { useState, useCallback, useMemo } from 'react'
import { useNetflowData } from '@/hooks/useNetflowData'
import { ForensicDashboard } from '@/components/forensic/ForensicDashboard'
import { LandingPage, type CRTLogEntry } from '@/components/landing/LandingPage'
import { CRTLoadingLog } from '@/components/landing/CRTLoadingLog'
import { ErrorBoundary } from '@/components/error'
import { logger } from '@/lib/logger'
import '@/styles/crt.css'

const appLogger = logger.child('App')

const DEMO_PARQUET_URL = 'https://pub-d25007b87b76480b851d23d324d67505.r2.dev/UWF-ZeekData24.parquet'

type DataSource =
  | { type: 'none' }
  | { type: 'url'; url: string; fileName: string }
  | { type: 'file'; file: File }

function App() {
  const [dataSource, setDataSource] = useState<DataSource>({ type: 'none' })

  // Determine URL for useNetflowData
  const loadUrl = dataSource.type === 'url' ? dataSource.url : ''

  const { loading, error, progress, logs } = useNetflowData(loadUrl)

  // Convert logs to CRT format
  const crtLogs = useMemo((): CRTLogEntry[] => {
    return logs.map((log, index) => {
      const isLast = index === logs.length - 1
      return {
        message: log.message,
        status: isLast && loading ? 'pending' : 'ok',
      }
    })
  }, [logs, loading])

  // Handle data source selection from landing page
  const handleDataReady = useCallback((source: { type: 'file'; file: File } | { type: 'url'; url: string }) => {
    if (source.type === 'url') {
      const fileName = source.url === DEMO_PARQUET_URL
        ? 'UWF-ZeekData24.parquet'
        : source.url.split('/').pop() || 'data.parquet'
      setDataSource({ type: 'url', url: source.url, fileName })
    } else {
      // TODO: Implement file upload handling
      // For now, show a message that file upload is coming
      setDataSource({
        type: 'url',
        url: DEMO_PARQUET_URL,
        fileName: source.file.name + ' (using demo data - file upload coming soon)',
      })
    }
  }, [])

  // Handle retry
  const handleRetry = useCallback(() => {
    setDataSource({ type: 'none' })
  }, [])

  // Landing page - no data source selected
  if (dataSource.type === 'none') {
    return (
      <ErrorBoundary
        context="Landing"
        onError={(error) => appLogger.error('Landing page error', { error: error.message })}
      >
        <LandingPage onDataReady={handleDataReady} />
      </ErrorBoundary>
    )
  }

  // Loading state - CRT styled
  if (loading) {
    const fileName = dataSource.type === 'url' ? dataSource.fileName : ''

    return (
      <div className="crt-container crt-scanlines min-h-screen flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-xl space-y-8">
          {/* Logo */}
          <div className="flex justify-center">
            <a
              href="https://www.securityronin.com/"
              target="_blank"
              rel="noopener noreferrer"
            >
              <img
                src="/security-ronin-logo.png"
                alt="Security Ronin"
                className="h-24 w-auto crt-logo"
              />
            </a>
          </div>

          {/* Loading log */}
          <CRTLoadingLog
            fileName={fileName}
            progress={progress.percent}
            logs={crtLogs}
          />

          {/* Footer */}
          <div className="text-center crt-glow-dim text-xs pt-8">
            Security Ronin • NetFlow Analysis
          </div>
        </div>
      </div>
    )
  }

  // Error state - CRT styled
  if (error) {
    return (
      <div className="crt-container crt-scanlines min-h-screen flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-xl space-y-8">
          {/* Logo */}
          <div className="flex justify-center">
            <a
              href="https://www.securityronin.com/"
              target="_blank"
              rel="noopener noreferrer"
            >
              <img
                src="/security-ronin-logo.png"
                alt="Security Ronin"
                className="h-24 w-auto crt-logo"
              />
            </a>
          </div>

          {/* Error message */}
          <div className="space-y-4">
            <div className="crt-glow text-lg">
              &gt; ERROR
            </div>
            <div className="crt-status-fail">
              [FAIL] {error}
            </div>
          </div>

          {/* Retry button */}
          <div className="text-center">
            <button onClick={handleRetry} className="crt-button">
              [RETRY]
            </button>
          </div>

          {/* Footer */}
          <div className="text-center crt-glow-dim text-xs pt-8">
            Security Ronin • NetFlow Analysis
          </div>
        </div>
      </div>
    )
  }

  // Main dashboard
  return (
    <ErrorBoundary
      context="Dashboard"
      onError={(error) => appLogger.error('Dashboard error', { error: error.message })}
    >
      <ForensicDashboard />
    </ErrorBoundary>
  )
}

export default App
