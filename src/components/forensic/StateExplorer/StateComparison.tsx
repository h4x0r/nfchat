import { memo } from 'react'
import { formatBytes, formatDuration } from '@/lib/formatting/traffic'
import type { StateProfile } from '@/lib/store/types'

interface StateComparisonProps {
  state1: StateProfile
  state2: StateProfile
}

/**
 * Calculate percentage delta between two values.
 * Returns null if baseline is zero to avoid division by zero.
 */
function calculateDelta(current: number, baseline: number): number | null {
  if (baseline === 0) return null
  return ((current - baseline) / baseline) * 100
}

interface DeltaIndicatorProps {
  delta: number | null
  /** If true, red means higher (suspicious metrics like bytes/duration) */
  redIsHigher?: boolean
}

function DeltaIndicator({ delta, redIsHigher = true }: DeltaIndicatorProps) {
  if (delta === null) return <span className="text-xs text-muted-foreground">N/A</span>

  const isIncrease = delta > 0
  const arrow = isIncrease ? '↑' : '↓'

  // For suspicious metrics (bytes, duration), red = higher, green = lower
  // For benign metrics, reverse
  const colorClass = redIsHigher
    ? (isIncrease ? 'text-red-500' : 'text-green-500')
    : (isIncrease ? 'text-green-500' : 'text-red-500')

  return (
    <span className={`text-xs font-mono ${colorClass}`}>
      {arrow} {Math.abs(delta).toFixed(0)}%
    </span>
  )
}

interface MetricRowProps {
  label: string
  value1: string
  value2: string
  delta: number | null
  redIsHigher?: boolean
}

function MetricRow({ label, value1, value2, delta, redIsHigher }: MetricRowProps) {
  return (
    <div className="grid grid-cols-[1fr_1fr_auto_1fr] items-center gap-2 text-xs py-1 border-b border-border">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-right">{value1}</span>
      <span className="w-16 text-center"><DeltaIndicator delta={delta} redIsHigher={redIsHigher} /></span>
      <span className="font-mono text-right">{value2}</span>
    </div>
  )
}

function PctRow({ label, pct1, pct2 }: { label: string; pct1: number; pct2: number }) {
  return (
    <div className="grid grid-cols-[1fr_1fr_auto_1fr] items-center gap-2 text-xs py-1 border-b border-border">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-right">{Math.round(pct1 * 100)}%</span>
      <span className="w-16" />
      <span className="font-mono text-right">{Math.round(pct2 * 100)}%</span>
    </div>
  )
}

export const StateComparison = memo(function StateComparison({
  state1,
  state2,
}: StateComparisonProps) {
  const inBytesDelta = calculateDelta(state2.avgInBytes, state1.avgInBytes)
  const outBytesDelta = calculateDelta(state2.avgOutBytes, state1.avgOutBytes)
  const durationDelta = calculateDelta(state2.avgDurationMs, state1.avgDurationMs)
  const pktsDelta = calculateDelta(state2.avgPktsPerSec, state1.avgPktsPerSec)
  const bppDelta = (state1.avgBytesPerPkt != null && state2.avgBytesPerPkt != null)
    ? calculateDelta(state2.avgBytesPerPkt, state1.avgBytesPerPkt)
    : null
  const gapDelta = (state1.avgInterFlowGapMs != null && state2.avgInterFlowGapMs != null)
    ? calculateDelta(state2.avgInterFlowGapMs, state1.avgInterFlowGapMs)
    : null

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      {/* Header */}
      <div className="grid grid-cols-[1fr_1fr_auto_1fr] items-center gap-2 mb-4">
        <div />
        <div className="text-center">
          <span className="font-semibold text-sm">State {state1.stateId}</span>
          <div className="text-xs text-muted-foreground">
            {state1.flowCount.toLocaleString()} flows
          </div>
        </div>
        <div className="w-16 text-center text-muted-foreground text-xs">vs</div>
        <div className="text-center">
          <span className="font-semibold text-sm">State {state2.stateId}</span>
          <div className="text-xs text-muted-foreground">
            {state2.flowCount.toLocaleString()} flows
          </div>
        </div>
      </div>

      {/* Traffic Profile */}
      <div className="mb-3">
        <div className="text-xs font-medium text-muted-foreground mb-2">Traffic Profile</div>
        <MetricRow label="Avg In" value1={formatBytes(state1.avgInBytes)} value2={formatBytes(state2.avgInBytes)} delta={inBytesDelta} />
        <MetricRow label="Avg Out" value1={formatBytes(state1.avgOutBytes)} value2={formatBytes(state2.avgOutBytes)} delta={outBytesDelta} />
        <MetricRow label="Duration" value1={formatDuration(state1.avgDurationMs)} value2={formatDuration(state2.avgDurationMs)} delta={durationDelta} />
        <MetricRow label="Pkts/sec" value1={state1.avgPktsPerSec.toFixed(1)} value2={state2.avgPktsPerSec.toFixed(1)} delta={pktsDelta} />
        {state1.avgBytesPerPkt != null && state2.avgBytesPerPkt != null && (
          <MetricRow label="Bytes/pkt" value1={state1.avgBytesPerPkt.toFixed(1)} value2={state2.avgBytesPerPkt.toFixed(1)} delta={bppDelta} />
        )}
        {state1.avgInterFlowGapMs != null && state2.avgInterFlowGapMs != null && (
          <MetricRow label="Flow gap" value1={formatDuration(state1.avgInterFlowGapMs)} value2={formatDuration(state2.avgInterFlowGapMs)} delta={gapDelta} />
        )}
      </div>

      {/* Connection States */}
      {state1.connCompletePct != null && state2.connCompletePct != null && (
        <div className="mb-3">
          <div className="text-xs font-medium text-muted-foreground mb-2">Connection States</div>
          <PctRow label="Complete (SF)" pct1={state1.connCompletePct} pct2={state2.connCompletePct} />
          <PctRow label="No Reply (S0)" pct1={state1.noReplyPct ?? 0} pct2={state2.noReplyPct ?? 0} />
          <PctRow label="Rejected" pct1={state1.rejectedPct ?? 0} pct2={state2.rejectedPct ?? 0} />
        </div>
      )}

      {/* Protocol Distribution */}
      <div className="mb-3">
        <div className="text-xs font-medium text-muted-foreground mb-2">Protocol Distribution</div>
        <PctRow label="TCP" pct1={state1.protocolDist.tcp} pct2={state2.protocolDist.tcp} />
        <PctRow label="UDP" pct1={state1.protocolDist.udp} pct2={state2.protocolDist.udp} />
        <PctRow label="ICMP" pct1={state1.protocolDist.icmp} pct2={state2.protocolDist.icmp} />
      </div>

      {/* Port Category Distribution */}
      <div>
        <div className="text-xs font-medium text-muted-foreground mb-2">Port Categories</div>
        <PctRow label="Well-known" pct1={state1.portCategoryDist.wellKnown} pct2={state2.portCategoryDist.wellKnown} />
        <PctRow label="Registered" pct1={state1.portCategoryDist.registered} pct2={state2.portCategoryDist.registered} />
        <PctRow label="Ephemeral" pct1={state1.portCategoryDist.ephemeral} pct2={state2.portCategoryDist.ephemeral} />
      </div>
    </div>
  )
})
