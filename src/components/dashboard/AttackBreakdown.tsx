import { ATTACK_COLORS, type AttackType } from '@/lib/schema'
import { Loader2 } from 'lucide-react'

export interface AttackData {
  attack: string
  count: number
}

interface AttackBreakdownProps {
  data: AttackData[]
  loading?: boolean
  onAttackClick?: (attack: string) => void
  showPercentage?: boolean
  maxItems?: number
  selectedAttack?: string
}

export function AttackBreakdown({
  data,
  loading = false,
  onAttackClick,
  showPercentage = false,
  maxItems,
  selectedAttack,
}: AttackBreakdownProps) {
  if (loading) {
    return (
      <div
        data-testid="attack-breakdown-loading"
        className="flex items-center justify-center h-full"
      >
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div
        data-testid="attack-breakdown"
        className="flex items-center justify-center h-full text-muted-foreground text-sm"
      >
        No data available
      </div>
    )
  }

  const displayData = maxItems ? data.slice(0, maxItems) : data
  const total = data.reduce((sum, d) => sum + d.count, 0)
  const maxCount = Math.max(...displayData.map((d) => d.count))

  return (
    <div data-testid="attack-breakdown" className="space-y-2 p-2 h-full overflow-y-auto">
      {displayData.map((item) => {
        const percentage = ((item.count / total) * 100).toFixed(1)
        const barWidth = (item.count / maxCount) * 100
        const color = ATTACK_COLORS[item.attack as AttackType] || '#6b7280'
        const isSelected = selectedAttack === item.attack

        return (
          <div
            key={item.attack}
            data-testid={`attack-bar-${item.attack}`}
            className={`cursor-pointer hover:opacity-80 transition-opacity ${
              isSelected ? 'selected ring-2 ring-primary rounded' : ''
            }`}
            onClick={() => onAttackClick?.(item.attack)}
          >
            <div className="flex justify-between text-xs mb-1">
              <span className="font-medium">{item.attack}</span>
              <span className="text-muted-foreground">
                {item.count.toLocaleString()}
                {showPercentage && ` (${percentage}%)`}
              </span>
            </div>
            <div className="h-4 bg-muted rounded overflow-hidden">
              <div
                className="h-full rounded transition-all"
                style={{
                  width: `${barWidth}%`,
                  backgroundColor: color,
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
