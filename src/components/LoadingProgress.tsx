import { useRef, useEffect } from 'react'
import { Progress } from '@/components/ui/progress'
import type { ProgressEvent, LogEntry, ProgressStage } from '@/lib/progress'

const stageLabels: Record<ProgressStage, string> = {
  initializing: 'Initializing',
  downloading: 'Downloading',
  parsing: 'Parsing',
  building: 'Building Dashboard',
  complete: 'Complete',
  error: 'Error',
}

const stageColors: Record<ProgressStage, string> = {
  initializing: 'bg-slate-500',
  downloading: 'bg-blue-500',
  parsing: 'bg-indigo-500',
  building: 'bg-purple-500',
  complete: 'bg-green-500',
  error: 'bg-red-500',
}

const logLevelColors: Record<LogEntry['level'], string> = {
  debug: 'text-slate-400',
  info: 'text-cyan-400',
  warn: 'text-amber-400',
  error: 'text-red-400',
}

interface LoadingProgressProps {
  progress: ProgressEvent
  logs: LogEntry[]
}

export function LoadingProgress({ progress, logs }: LoadingProgressProps) {
  const logContainerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }, [logs.length])

  const stageLabel = stageLabels[progress.stage]
  const colorClass = stageColors[progress.stage]

  return (
    <div className="w-full space-y-4">
      {/* Progress section */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-foreground">{stageLabel}</span>
          <span className="text-sm font-bold text-foreground">{Math.round(progress.percent)}%</span>
        </div>

        <Progress
          value={progress.percent}
          className="h-3"
          aria-valuenow={progress.percent}
        />

        <p className="text-xs text-muted-foreground text-center">{progress.message}</p>
      </div>

      {/* Log panel */}
      {logs.length > 0 && (
        <div
          ref={logContainerRef}
          className="bg-slate-900 rounded-lg p-3 h-48 overflow-y-auto font-mono text-xs"
        >
          {logs.map((log, i) => (
            <div key={i} className={`${logLevelColors[log.level]} leading-relaxed`}>
              {log.message}
            </div>
          ))}
          <div className="text-green-400 animate-pulse">▌</div>
        </div>
      )}
    </div>
  )
}
