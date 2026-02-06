import { useCallback } from 'react'
import { useStore } from '@/lib/store'
import { DiscoveryControls } from './DiscoveryControls'
import { StateCard } from './StateCard'
import { extractFeatures, ensureHmmStateColumn, writeStateAssignments, getStateSignatures, updateStateTactic } from '@/lib/motherduck/queries'
import { GaussianHMM, StandardScaler, suggestTactic } from '@/lib/hmm'
import { logger } from '@/lib/logger'
import type { StateProfile } from '@/lib/store/types'

const stateExplorerLogger = logger.child('StateExplorer')

const SAMPLE_SIZE = 50_000

const yieldToMain = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

/**
 * State Explorer - discover behavioral states via HMM and assign ATT&CK tactics.
 */
export function StateExplorer() {
  const hmmStates = useStore((s) => s.hmmStates)
  const hmmTraining = useStore((s) => s.hmmTraining)
  const hmmProgress = useStore((s) => s.hmmProgress)
  const hmmError = useStore((s) => s.hmmError)
  const tacticAssignments = useStore((s) => s.tacticAssignments)
  const expandedState = useStore((s) => s.expandedState)

  const setHmmStates = useStore((s) => s.setHmmStates)
  const setHmmTraining = useStore((s) => s.setHmmTraining)
  const setHmmProgress = useStore((s) => s.setHmmProgress)
  const setHmmError = useStore((s) => s.setHmmError)
  const setTacticAssignment = useStore((s) => s.setTacticAssignment)
  const setExpandedState = useStore((s) => s.setExpandedState)

  const handleDiscover = useCallback(async (requestedStates: number) => {
    setHmmTraining(true)
    setHmmProgress(0)
    setHmmError(null)

    try {
      // Ensure HMM_STATE column exists
      await ensureHmmStateColumn()

      // Extract features from a random sample of flows
      const featureRows = await extractFeatures(SAMPLE_SIZE)
      if (featureRows.length < 10) {
        throw new Error('Insufficient data for training (need at least 10 flows)')
      }

      setHmmProgress(10)
      await yieldToMain()

      // Convert to feature matrix
      const matrix = featureRows.map((row) => [
        row.log1p_in_bytes, row.log1p_out_bytes, row.log1p_in_pkts, row.log1p_out_pkts,
        row.log1p_duration_ms, row.log1p_iat_avg, row.bytes_ratio, row.pkts_per_second,
        row.is_tcp, row.is_udp, row.is_icmp, row.port_category,
      ])

      // Scale features
      const scaler = new StandardScaler()
      const scaled = scaler.fitTransform(matrix)

      setHmmProgress(20)
      await yieldToMain()

      // Determine state count
      let nStates: number
      if (requestedStates > 0) {
        nStates = requestedStates
      } else {
        // Auto-select via BIC over range 4-10
        let bestBic = Infinity
        nStates = 4
        for (let k = 4; k <= 10; k++) {
          const candidate = new GaussianHMM(k, 12, { maxIter: 20, seed: 42 })
          candidate.fit([scaled])
          const bic = candidate.bic([scaled])
          if (bic < bestBic) {
            bestBic = bic
            nStates = k
          }
          await yieldToMain()
        }
      }

      setHmmProgress(40)
      await yieldToMain()

      // Train final model
      const hmm = new GaussianHMM(nStates, 12, { maxIter: 100, seed: 42 })
      hmm.fit([scaled], {
        onProgress: (iter, maxIter) => {
          setHmmProgress(40 + Math.round((iter / maxIter) * 40))
        },
      })

      setHmmProgress(80)
      await yieldToMain()

      // Predict states
      const states = hmm.predict(scaled)

      // Write state assignments back to DuckDB
      const assignments = new Map<number, number>()
      for (let i = 0; i < states.length; i++) {
        assignments.set(featureRows[i].rowid, states[i])
      }
      await writeStateAssignments(assignments)

      setHmmProgress(90)

      // Get state signatures from DB
      const signatures = await getStateSignatures()

      // Build StateProfile objects with tactic suggestions
      const profiles: StateProfile[] = signatures.map((sig) => {
        const suggestion = suggestTactic({
          stateId: sig.state_id,
          flowCount: sig.flow_count,
          avgInBytes: sig.avg_in_bytes,
          avgOutBytes: sig.avg_out_bytes,
          bytesRatio: sig.bytes_ratio,
          avgDurationMs: sig.avg_duration_ms,
          avgPktsPerSec: sig.avg_pkts_per_sec,
          protocolDist: { tcp: sig.tcp_pct, udp: sig.udp_pct, icmp: sig.icmp_pct },
          portCategoryDist: { wellKnown: sig.well_known_pct, registered: sig.registered_pct, ephemeral: sig.ephemeral_pct },
        })

        return {
          stateId: sig.state_id,
          flowCount: sig.flow_count,
          avgInBytes: sig.avg_in_bytes,
          avgOutBytes: sig.avg_out_bytes,
          bytesRatio: sig.bytes_ratio,
          avgDurationMs: sig.avg_duration_ms,
          avgPktsPerSec: sig.avg_pkts_per_sec,
          protocolDist: { tcp: sig.tcp_pct, udp: sig.udp_pct, icmp: sig.icmp_pct },
          portCategoryDist: { wellKnown: sig.well_known_pct, registered: sig.registered_pct, ephemeral: sig.ephemeral_pct },
          suggestedTactic: suggestion.tactic,
          suggestedConfidence: suggestion.confidence,
        }
      })

      setHmmStates(profiles)
      setHmmProgress(100)
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'HMM training failed'
      stateExplorerLogger.error('Discovery failed', { error: msg })
      setHmmError(msg)
    } finally {
      setHmmTraining(false)
    }
  }, [setHmmStates, setHmmTraining, setHmmProgress, setHmmError])

  const handleTacticAssign = useCallback((stateId: number, tactic: string) => {
    setTacticAssignment(stateId, tactic)
  }, [setTacticAssignment])

  const handleSaveAll = useCallback(async () => {
    for (const [stateId, tactic] of Object.entries(tacticAssignments)) {
      await updateStateTactic(Number(stateId), tactic)
    }
  }, [tacticAssignments])

  const handleToggleExpand = useCallback((stateId: number) => {
    setExpandedState(expandedState === stateId ? null : stateId)
  }, [expandedState, setExpandedState])

  return (
    <div className="flex flex-col h-full bg-background">
      <DiscoveryControls
        onDiscover={handleDiscover}
        training={hmmTraining}
        progress={hmmProgress}
        statesDiscovered={hmmStates.length}
        error={hmmError}
      />

      {hmmStates.length > 0 ? (
        <>
          <div className="flex-1 overflow-auto p-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {hmmStates.map((state) => (
                <StateCard
                  key={state.stateId}
                  state={state}
                  assignedTactic={tacticAssignments[state.stateId]}
                  onTacticAssign={handleTacticAssign}
                  expanded={expandedState === state.stateId}
                  onToggleExpand={() => handleToggleExpand(state.stateId)}
                />
              ))}
            </div>
          </div>
          <div className="px-4 py-3 border-t border-border">
            <button
              onClick={handleSaveAll}
              className="px-4 py-2 text-sm font-medium rounded bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Save All Labels
            </button>
          </div>
        </>
      ) : !hmmTraining && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <p className="text-lg mb-2">No states discovered yet</p>
            <p className="text-sm">Click "Discover States" to analyze flow behaviors using Hidden Markov Model clustering.</p>
          </div>
        </div>
      )}
    </div>
  )
}
