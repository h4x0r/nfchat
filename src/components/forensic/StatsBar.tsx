import { useStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { AttackPopover } from './popovers/AttackPopover'
import { TopTalkersPopover } from './popovers/TopTalkersPopover'

interface StatsBarProps {
  onFilter: (column: string, value: string) => void
}

/**
 * Stats bar showing at-a-glance metrics.
 * Click any stat to see detail popover with drill-down options.
 */
export function StatsBar({ onFilter }: StatsBarProps) {
  const totalFlowCount = useStore((s) => s.totalFlowCount)
  const attackBreakdown = useStore((s) => s.attackBreakdown)
  const topSrcIPs = useStore((s) => s.topSrcIPs)
  const topDstIPs = useStore((s) => s.topDstIPs)
  const hideBenign = useStore((s) => s.hideBenign)
  const toggleHideBenign = useStore((s) => s.toggleHideBenign)

  // Format large numbers
  const formatCount = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
    return n.toString()
  }

  return (
    <div
      data-testid="stats-bar"
      className="flex items-center gap-6 px-4 py-2 border-b border-border bg-muted/30 text-sm"
    >
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">📊</span>
        <span className="font-medium">{formatCount(totalFlowCount)}</span>
        <span className="text-muted-foreground">flows</span>
      </div>

      <AttackPopover data={attackBreakdown} onFilter={onFilter} />

      <TopTalkersPopover
        topSrcIPs={topSrcIPs}
        topDstIPs={topDstIPs}
        onFilter={onFilter}
      />

      <Button
        variant={hideBenign ? 'default' : 'outline'}
        size="sm"
        onClick={toggleHideBenign}
        className="ml-auto"
      >
        {hideBenign ? 'Showing Attacks' : 'Hide Benign'}
      </Button>
    </div>
  )
}
