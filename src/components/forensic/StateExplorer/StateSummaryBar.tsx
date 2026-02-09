import { memo } from 'react'
import { ATTACK_COLORS } from '@/lib/schema'
import type { StateProfile } from '@/lib/store/types'

interface StateSummaryBarProps {
  states: StateProfile[]
  tacticAssignments: Record<number, string>
  onStateClick?: (stateId: number) => void
}

export const StateSummaryBar = memo(function StateSummaryBar({
  states,
  tacticAssignments,
  onStateClick,
}: StateSummaryBarProps) {
  if (states.length === 0) return null

  const totalFlows = states.reduce((sum, s) => sum + s.flowCount, 0)

  return (
    <div className="px-4 py-3">
      <div className="flex h-6 w-full rounded overflow-hidden">
        {states.map((state) => {
          const tactic = tacticAssignments[state.stateId] || 'Unassigned'
          const color = ATTACK_COLORS[tactic] || '#71717a'
          const widthPct = totalFlows > 0 ? (state.flowCount / totalFlows) * 100 : 0

          return (
            <button
              key={state.stateId}
              data-testid={`segment-${state.stateId}`}
              className="h-full transition-opacity hover:opacity-80 cursor-pointer border-0 p-0"
              style={{ width: `${widthPct}%`, backgroundColor: color }}
              onClick={() => onStateClick?.(state.stateId)}
              title={`State ${state.stateId}: ${state.flowCount.toLocaleString()} flows (${tactic})`}
            />
          )
        })}
      </div>
      <div className="text-xs text-muted-foreground mt-1">
        {totalFlows.toLocaleString()} total flows across {states.length} states
      </div>
    </div>
  )
})
