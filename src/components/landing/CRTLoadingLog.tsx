import '@/styles/crt.css'

export interface CRTLogEntry {
  message: string
  status: 'ok' | 'pending' | 'fail'
}

interface CRTLoadingLogProps {
  fileName: string
  progress: number
  logs: CRTLogEntry[]
}

export function CRTLoadingLog({ fileName, progress, logs }: CRTLoadingLogProps) {
  return (
    <div className="space-y-4">
      {/* Loading header */}
      <div className="crt-glow text-lg">
        &gt; Loading {fileName}
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="crt-progress">
          <div
            data-testid="crt-progress-bar"
            className="crt-progress-bar"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="text-right crt-glow-dim text-sm">
          {progress}%
        </div>
      </div>

      {/* Log entries */}
      <div className="space-y-1 font-mono text-sm">
        {logs.map((log, index) => (
          <div
            key={index}
            className={`flex gap-2 ${log.status === 'pending' ? 'crt-cursor' : ''}`}
          >
            <span className={getStatusClass(log.status)}>
              {getStatusIndicator(log.status)}
            </span>
            <span className={log.status === 'fail' ? 'crt-status-fail' : 'crt-glow-dim'}>
              {log.message}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function getStatusIndicator(status: CRTLogEntry['status']): string {
  switch (status) {
    case 'ok':
      return '[OK]'
    case 'pending':
      return '[..]'
    case 'fail':
      return '[FAIL]'
  }
}

function getStatusClass(status: CRTLogEntry['status']): string {
  switch (status) {
    case 'ok':
      return 'crt-status-ok'
    case 'pending':
      return 'crt-status-pending'
    case 'fail':
      return 'crt-status-fail'
  }
}
