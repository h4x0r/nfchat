import { useMemo } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Brush,
} from 'recharts'
import { Loader2 } from 'lucide-react'
import { ATTACK_COLORS, ATTACK_TYPES, type AttackType } from '@/lib/schema'

export interface TimelineData {
  time: number
  attack: string
  count: number
}

interface TimelineProps {
  data: TimelineData[]
  loading?: boolean
  showLegend?: boolean
  onBrushChange?: (start: number, end: number) => void
}

interface StackedDataPoint {
  time: number
  [key: string]: number
}

function transformToStacked(data: TimelineData[]): StackedDataPoint[] {
  const grouped = new Map<number, StackedDataPoint>()

  for (const item of data) {
    if (!grouped.has(item.time)) {
      grouped.set(item.time, { time: item.time })
    }
    const point = grouped.get(item.time)!
    point[item.attack] = (point[item.attack] || 0) + item.count
  }

  return Array.from(grouped.values()).sort((a, b) => a.time - b.time)
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function TimelineChart({
  data,
  loading = false,
  showLegend = false,
  onBrushChange,
}: TimelineProps) {
  const stackedData = useMemo(() => transformToStacked(data), [data])

  const attackTypesInData = useMemo(() => {
    const types = new Set<string>()
    for (const item of data) {
      types.add(item.attack)
    }
    // Return in defined order
    return ATTACK_TYPES.filter((t) => types.has(t))
  }, [data])

  if (loading) {
    return (
      <div
        data-testid="timeline-loading"
        className="flex items-center justify-center h-full"
      >
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div
        data-testid="timeline-chart"
        className="flex items-center justify-center h-full text-muted-foreground text-sm"
      >
        No data available
      </div>
    )
  }

  const handleBrush = (brushData: { startIndex?: number; endIndex?: number }) => {
    if (
      onBrushChange &&
      brushData.startIndex !== undefined &&
      brushData.endIndex !== undefined
    ) {
      const startTime = stackedData[brushData.startIndex]?.time
      const endTime = stackedData[brushData.endIndex]?.time
      if (startTime && endTime) {
        onBrushChange(startTime, endTime)
      }
    }
  }

  return (
    <div data-testid="timeline-chart" className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={stackedData}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
          <XAxis
            dataKey="time"
            tickFormatter={formatTime}
            tick={{ fontSize: 10 }}
            stroke="hsl(var(--muted-foreground))"
          />
          <YAxis
            tick={{ fontSize: 10 }}
            stroke="hsl(var(--muted-foreground))"
            tickFormatter={(v) => v.toLocaleString()}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '6px',
            }}
            labelFormatter={(value) => new Date(value).toLocaleString()}
          />
          {showLegend && <Legend />}
          {attackTypesInData.map((attackType) => (
            <Area
              key={attackType}
              type="monotone"
              dataKey={attackType}
              stackId="1"
              fill={ATTACK_COLORS[attackType as AttackType]}
              stroke={ATTACK_COLORS[attackType as AttackType]}
              fillOpacity={0.6}
            />
          ))}
          {onBrushChange && (
            <Brush
              dataKey="time"
              height={20}
              stroke="hsl(var(--primary))"
              tickFormatter={formatTime}
              onChange={handleBrush}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
