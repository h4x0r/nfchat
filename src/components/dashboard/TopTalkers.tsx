import { Loader2 } from 'lucide-react'

export interface TalkerData {
  ip: string
  value: number
}

interface TopTalkersProps {
  data: TalkerData[]
  loading?: boolean
  onIpClick?: (ip: string) => void
  direction?: 'src' | 'dst'
  metric?: 'bytes' | 'flows'
  formatValue?: 'full' | 'abbreviated'
  maxItems?: number
  selectedIp?: string
}

function formatNumber(value: number, format: 'full' | 'abbreviated'): string {
  if (format === 'abbreviated') {
    if (value >= 1000000000) {
      return `${(value / 1000000000).toFixed(1)}B`
    }
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`
    }
    return value.toString()
  }
  return value.toLocaleString()
}

export function TopTalkers({
  data,
  loading = false,
  onIpClick,
  direction = 'src',
  metric = 'bytes',
  formatValue = 'full',
  maxItems,
  selectedIp,
}: TopTalkersProps) {
  if (loading) {
    return (
      <div
        data-testid="top-talkers-loading"
        className="flex items-center justify-center h-full"
      >
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div
        data-testid="top-talkers"
        className="flex items-center justify-center h-full text-muted-foreground text-sm"
      >
        No data available
      </div>
    )
  }

  const displayData = maxItems ? data.slice(0, maxItems) : data
  const maxValue = Math.max(...displayData.map((d) => d.value))

  const directionLabel = direction === 'src' ? 'Source' : 'Destination'
  const metricLabel = metric === 'bytes' ? 'Bytes' : 'Flows'

  return (
    <div data-testid="top-talkers" className="space-y-2 p-2 h-full overflow-y-auto">
      <div className="text-xs text-muted-foreground mb-2">
        Top {directionLabel} IPs by {metricLabel}
      </div>
      {displayData.map((item) => {
        const barWidth = (item.value / maxValue) * 100
        const isSelected = selectedIp === item.ip

        return (
          <div
            key={item.ip}
            data-testid={`ip-bar-${item.ip}`}
            className={`cursor-pointer hover:opacity-80 transition-opacity ${
              isSelected ? 'selected ring-2 ring-primary rounded' : ''
            }`}
            onClick={() => onIpClick?.(item.ip)}
          >
            <div className="flex justify-between text-xs mb-1">
              <span className="font-mono font-medium">{item.ip}</span>
              <span className="text-muted-foreground">
                {formatNumber(item.value, formatValue)}
              </span>
            </div>
            <div className="h-3 bg-muted rounded overflow-hidden">
              <div
                className="h-full bg-primary rounded transition-all"
                style={{ width: `${barWidth}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
