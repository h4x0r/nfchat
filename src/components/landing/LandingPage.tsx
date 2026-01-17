import { useState, useCallback } from 'react'
import { CRTDropzone } from './CRTDropzone'
import { CRTLoadingLog, type CRTLogEntry } from './CRTLoadingLog'
import '@/styles/crt.css'

const DEMO_PARQUET_URL = 'https://pub-d25007b87b76480b851d23d324d67505.r2.dev/NF-UNSW-NB15-v3.parquet'

type PageState = 'ready' | 'loading' | 'error'

interface LandingPageProps {
  onDataReady: (source: { type: 'file'; file: File } | { type: 'url'; url: string }) => void
}

export function LandingPage({ onDataReady }: LandingPageProps) {
  const [state, setState] = useState<PageState>('ready')
  const [fileName, setFileName] = useState('')
  const [progress, setProgress] = useState(0)
  const [logs, setLogs] = useState<CRTLogEntry[]>([])

  const handleFileDrop = useCallback((file: File) => {
    setFileName(file.name)
    setState('loading')
    setProgress(0)
    setLogs([{ message: 'Processing file...', status: 'pending' }])

    // Notify parent - actual loading handled by parent
    onDataReady({ type: 'file', file })
  }, [onDataReady])

  const handleDemoClick = useCallback(() => {
    setFileName('NF-UNSW-NB15-v3.parquet')
    setState('loading')
    setProgress(0)
    setLogs([{ message: 'Connecting to MotherDuck...', status: 'pending' }])

    // Notify parent - actual loading handled by parent
    onDataReady({ type: 'url', url: DEMO_PARQUET_URL })
  }, [onDataReady])

  // Expose progress update for parent to call
  // In real implementation, this would be connected to the loading hook
  // For now, the parent (App.tsx) will manage actual loading state

  return (
    <div
      data-testid="landing-page"
      className="crt-container crt-scanlines min-h-screen flex flex-col items-center justify-center p-8"
    >
      <div className="w-full max-w-xl space-y-8">
        {/* Logo */}
        <div className="flex justify-center">
          <a
            href="https://www.securityronin.com/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Security Ronin"
          >
            <img
              src="/security-ronin-logo.png"
              alt="Security Ronin"
              className="h-24 w-auto"
            />
          </a>
        </div>

        {/* Headline */}
        <div className="text-center">
          <h1 className="crt-glow text-2xl crt-cursor">
            &gt; Interrogate your NetFlow data
          </h1>
        </div>

        {/* Content - changes based on state */}
        {state === 'ready' && (
          <>
            <CRTDropzone onFileDrop={handleFileDrop} />

            <div className="text-center">
              <button
                onClick={handleDemoClick}
                className="crt-link text-sm"
              >
                &gt; or try demo dataset (2.4M flows)
              </button>
            </div>
          </>
        )}

        {state === 'loading' && (
          <CRTLoadingLog
            fileName={fileName}
            progress={progress}
            logs={logs}
          />
        )}

        {/* Footer */}
        <div className="text-center crt-glow-dim text-xs pt-8">
          Powered by MotherDuck
        </div>
      </div>
    </div>
  )
}

// Export for parent to update loading state
export type { CRTLogEntry }
