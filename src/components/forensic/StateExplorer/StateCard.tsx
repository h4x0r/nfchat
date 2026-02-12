import { memo } from 'react'
import { useStore } from '@/lib/store'
import { useStateDetails } from '@/hooks/useStateDetails'
import { formatBytes, formatDuration, getTacticColor } from '@/lib/formatting/traffic'
import { TacticSelector } from './TacticSelector'
import { MiniTimeline } from './MiniTimeline'
import { FlowPreview } from './FlowPreview'
import { generateNarrative } from '@/lib/hmm/narrative'
import type { StateProfile } from '@/lib/store/types'

interface StateCardProps {
  state: StateProfile
  assignedTactic?: string
  onTacticAssign: (stateId: number, tactic: string) => void
  expanded: boolean
  onToggleExpand: () => void
  selectedForComparison?: boolean
  onToggleCompare?: () => void
}

function PercentBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100)
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-10 text-muted-foreground">{label}</span>
      <div className="flex-1 h-2 bg-muted rounded overflow-hidden">
        <div
          className="h-full bg-primary/60 rounded"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-8 text-right font-mono">{pct}%</span>
    </div>
  )
}

export const StateCard = memo(function StateCard({
  state,
  assignedTactic,
  onTacticAssign,
  expanded,
  onToggleExpand,
  selectedForComparison = false,
  onToggleCompare,
}: StateCardProps) {
  const { topHosts, timeline, connStates, portServices, sampleFlows, loading: flowsLoading } = useStateDetails(state.stateId, expanded)

  const currentTactic = assignedTactic || ''
  const tacticColor = currentTactic ? getTacticColor(currentTactic) : '#71717a'

  return (
    <div
      className="rounded-lg border border-border bg-card p-4"
      style={{ borderLeftColor: tacticColor, borderLeftWidth: 3 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">State {state.stateId}</span>
          <span className="text-xs text-muted-foreground">
            {state.flowCount.toLocaleString()} flows
          </span>
          {state.anomalyScore !== undefined && state.anomalyScore > 0 && (
            <span
              className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                state.anomalyScore >= 80
                  ? 'bg-red-500/20 text-red-700 dark:text-red-400'
                  : state.anomalyScore >= 50
                  ? 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400'
                  : 'bg-green-500/20 text-green-700 dark:text-green-400'
              }`}
              title={state.anomalyFactors?.join(', ') || 'Anomaly detected'}
            >
              ⚠ {state.anomalyScore}
            </span>
          )}
          <button
            className="text-xs text-primary hover:underline"
            onClick={() => {
              useStore.getState().setSelectedHmmState(state.stateId)
              useStore.getState().setActiveView('dashboard')
            }}
          >
            View Flows →
          </button>
          {onToggleCompare && (
            <button
              className={`text-xs px-2 py-0.5 rounded border ${
                selectedForComparison
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border hover:bg-accent'
              }`}
              onClick={onToggleCompare}
              title={selectedForComparison ? 'Remove from comparison' : 'Add to comparison'}
            >
              {selectedForComparison ? '✓ Compare' : 'Compare'}
            </button>
          )}
        </div>
        <TacticSelector
          stateId={state.stateId}
          assignedTactic={assignedTactic}
          onAssign={onTacticAssign}
        />
      </div>

      {/* Narrative Summary */}
      <p className="text-xs text-muted-foreground italic mb-3">
        {generateNarrative(state)}
      </p>

      {/* Traffic Profile */}
      <div className="grid grid-cols-3 gap-2 mb-3 text-xs">
        <div>
          <div className="text-muted-foreground">Avg In</div>
          <div className="font-mono font-medium">{formatBytes(state.avgInBytes)}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Avg Out</div>
          <div className="font-mono font-medium">{formatBytes(state.avgOutBytes)}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Duration</div>
          <div className="font-mono font-medium">{formatDuration(state.avgDurationMs)}</div>
        </div>
        {state.avgBytesPerPkt != null && (
          <div>
            <div className="text-muted-foreground">Bytes/pkt</div>
            <div className="font-mono font-medium">{state.avgBytesPerPkt.toFixed(0)}</div>
          </div>
        )}
        {state.avgInterFlowGapMs != null && (
          <div>
            <div className="text-muted-foreground">Flow gap</div>
            <div className="font-mono font-medium">{formatDuration(state.avgInterFlowGapMs)}</div>
          </div>
        )}
      </div>

      {/* Connection State Indicators */}
      {state.connCompletePct != null && (
        <div className="flex gap-3 mb-3 text-xs">
          <span className="px-1.5 py-0.5 rounded bg-green-500/10 text-green-700 dark:text-green-400 font-mono">
            SF {Math.round(state.connCompletePct * 100)}%
          </span>
          {(state.noReplyPct ?? 0) > 0.01 && (
            <span className="px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 font-mono">
              S0 {Math.round((state.noReplyPct ?? 0) * 100)}%
            </span>
          )}
          {(state.rejectedPct ?? 0) > 0.01 && (
            <span className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-700 dark:text-red-400 font-mono">
              REJ {Math.round((state.rejectedPct ?? 0) * 100)}%
            </span>
          )}
        </div>
      )}

      {/* Protocol Distribution */}
      <div className="space-y-1 mb-3">
        <PercentBar label="TCP" value={state.protocolDist.tcp} />
        <PercentBar label="UDP" value={state.protocolDist.udp} />
        {state.protocolDist.icmp > 0.01 && (
          <PercentBar label="ICMP" value={state.protocolDist.icmp} />
        )}
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="space-y-3 mt-3 pt-3 border-t border-border">
          {/* Top Hosts */}
          {(topHosts.srcHosts.length > 0 || topHosts.dstHosts.length > 0) && (
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <div className="text-muted-foreground font-medium mb-1">Top Sources</div>
                {topHosts.srcHosts.map((h) => (
                  <div key={h.ip} className="font-mono flex justify-between">
                    <span>{h.ip}</span>
                    <span className="text-muted-foreground">{h.count}</span>
                  </div>
                ))}
              </div>
              <div>
                <div className="text-muted-foreground font-medium mb-1">Top Destinations</div>
                {topHosts.dstHosts.map((h) => (
                  <div key={h.ip} className="font-mono flex justify-between">
                    <span>{h.ip}</span>
                    <span className="text-muted-foreground">{h.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Connection States */}
          {connStates.length > 0 && (
            <div className="text-xs">
              <div className="text-muted-foreground font-medium mb-1">Connection States</div>
              <div className="flex flex-wrap gap-1">
                {connStates.map((cs) => (
                  <span key={cs.state} className="px-1.5 py-0.5 rounded bg-muted font-mono">
                    {cs.state}: {cs.count}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Timeline */}
          {timeline.length > 0 && (
            <div>
              <div className="text-xs text-muted-foreground font-medium mb-1">Timeline</div>
              <MiniTimeline buckets={timeline} />
            </div>
          )}

          {/* Ports & Services */}
          {(portServices.ports.length > 0 || portServices.services.length > 0) && (
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <div className="text-muted-foreground font-medium mb-1">Top Ports</div>
                {portServices.ports.map((p) => (
                  <div key={p.port} className="font-mono flex justify-between">
                    <span>{p.port}</span>
                    <span className="text-muted-foreground">{p.count}</span>
                  </div>
                ))}
              </div>
              {portServices.services.length > 0 && (
                <div>
                  <div className="text-muted-foreground font-medium mb-1">Services</div>
                  {portServices.services.map((s) => (
                    <div key={s.service} className="font-mono flex justify-between">
                      <span>{s.service}</span>
                      <span className="text-muted-foreground">{s.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Flow Preview */}
      <FlowPreview
        flows={sampleFlows}
        totalFlowCount={state.flowCount}
        loading={flowsLoading}
        expanded={expanded}
        onExpand={onToggleExpand}
      />
    </div>
  )
})
