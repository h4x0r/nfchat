import { useCallback, useEffect, useRef, useState } from 'react'
import { useStore } from '@/lib/store'
import { useStateGrid } from '@/hooks/useStateGrid'
import { discoverStates } from '@/lib/hmm/discovery-service'
import { DiscoveryControls } from './DiscoveryControls'
import { StateSummaryBar } from './StateSummaryBar'
import { StateTransitions } from './StateTransitions'
import { StateTemporal } from './StateTemporal'
import { StateCard } from './StateCard'
import { StateComparison } from './StateComparison'
import { StateGridControls } from './StateGridControls'
import { ErrorBoundary } from '@/components/error/ErrorBoundary'
import { updateStateTactic, getStateTransitions, getStateTemporalDist } from '@/lib/motherduck/queries'
import type { StateTransition, TemporalBucket } from '@/lib/motherduck/queries/hmm'
import { logger } from '@/lib/logger'

const stateExplorerLogger = logger.child('StateExplorer')

const SAMPLE_SIZE = 10_000

/**
 * State Explorer - discover behavioral states via HMM and assign ATT&CK tactics.
 */
export function StateExplorer() {
  const hmmStates = useStore((s) => s.hmmStates)
  const hmmTraining = useStore((s) => s.hmmTraining)
  const hmmProgress = useStore((s) => s.hmmProgress)
  const hmmError = useStore((s) => s.hmmError)
  const tacticAssignments = useStore((s) => s.tacticAssignments)
  const hmmConverged = useStore((s) => s.hmmConverged)
  const hmmIterations = useStore((s) => s.hmmIterations)

  const [expandedState, setExpandedState] = useState<number | null>(null)
  const expandedStateRef = useRef<number | null>(null)

  const [transitions, setTransitions] = useState<StateTransition[]>([])
  const [temporalBuckets, setTemporalBuckets] = useState<TemporalBucket[]>([])

  const setHmmStates = useStore((s) => s.setHmmStates)
  const setHmmTraining = useStore((s) => s.setHmmTraining)
  const setHmmProgress = useStore((s) => s.setHmmProgress)
  const setHmmError = useStore((s) => s.setHmmError)
  const setTacticAssignment = useStore((s) => s.setTacticAssignment)
  const setHmmConverged = useStore((s) => s.setHmmConverged)
  const setHmmIterations = useStore((s) => s.setHmmIterations)
  const setHmmLogLikelihood = useStore((s) => s.setHmmLogLikelihood)

  const grid = useStateGrid(hmmStates, tacticAssignments)

  const handleDiscover = useCallback(async () => {
    setHmmTraining(true)
    setHmmProgress(0)
    setHmmError(null)
    setHmmConverged(null)
    setHmmIterations(null)
    setHmmLogLikelihood(null)

    try {
      const result = await discoverStates({
        requestedStates: 0,
        sampleSize: SAMPLE_SIZE,
        onProgress: setHmmProgress,
      })

      setHmmConverged(result.converged)
      setHmmIterations(result.iterations)
      setHmmLogLikelihood(result.logLikelihood)
      setHmmStates(result.profiles)
      setHmmProgress(100)

      // Load analysis data in background
      Promise.all([getStateTransitions(), getStateTemporalDist()])
        .then(([trans, temporal]) => {
          setTransitions(trans)
          setTemporalBuckets(temporal)
        })
        .catch((err) => stateExplorerLogger.warn('Failed to load analysis data', { error: String(err) }))
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'HMM training failed'
      stateExplorerLogger.error('Discovery failed', { error: msg })
      setHmmError(msg)
    } finally {
      setHmmTraining(false)
    }
  }, [setHmmStates, setHmmTraining, setHmmProgress, setHmmError, setHmmConverged, setHmmIterations, setHmmLogLikelihood])

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

  const handleExportJson = useCallback(() => {
    stateExplorerLogger.info('Exporting state profiles', { count: hmmStates.length })
    const exported = hmmStates.map((state) => ({
      stateId: state.stateId,
      flowCount: state.flowCount,
      avgInBytes: state.avgInBytes,
      avgOutBytes: state.avgOutBytes,
      bytesRatio: state.bytesRatio,
      avgDurationMs: state.avgDurationMs,
      avgPktsPerSec: state.avgPktsPerSec,
      protocolDist: state.protocolDist,
      portCategoryDist: state.portCategoryDist,
      tactic: tacticAssignments[state.stateId] || 'Unassigned',
    }))

    const blob = new Blob([JSON.stringify(exported, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `state-profiles-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [hmmStates, tacticAssignments])

  // Keep ref in sync for keyboard handler
  useEffect(() => {
    expandedStateRef.current = expandedState
  }, [expandedState])

  // Keyboard navigation for state cards
  useEffect(() => {
    if (hmmStates.length === 0) return

    const handleKeyDown = (e: KeyboardEvent) => {
      const currentStates = useStore.getState().hmmStates
      const currentExpanded = expandedStateRef.current

      if (e.key === 'ArrowRight') {
        if (currentExpanded === null) {
          setExpandedState(currentStates[0].stateId)
        } else {
          const idx = currentStates.findIndex((s) => s.stateId === currentExpanded)
          const nextIdx = (idx + 1) % currentStates.length
          setExpandedState(currentStates[nextIdx].stateId)
        }
      } else if (e.key === 'ArrowLeft') {
        if (currentExpanded === null) {
          setExpandedState(currentStates[currentStates.length - 1].stateId)
        } else {
          const idx = currentStates.findIndex((s) => s.stateId === currentExpanded)
          const prevIdx = (idx - 1 + currentStates.length) % currentStates.length
          setExpandedState(currentStates[prevIdx].stateId)
        }
      } else if (e.key === 'Escape') {
        setExpandedState(null)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [hmmStates.length])

  return (
    <ErrorBoundary context="StateExplorer">
    <div className="flex flex-col h-full bg-background">
      <DiscoveryControls
        onDiscover={handleDiscover}
        training={hmmTraining}
        progress={hmmProgress}
        statesDiscovered={hmmStates.length}
        error={hmmError}
        converged={hmmConverged}
        iterations={hmmIterations}
      />

      {hmmStates.length > 0 ? (
        <>
          <StateSummaryBar
            states={hmmStates}
            tacticAssignments={tacticAssignments}
            onStateClick={(stateId) => {
              useStore.getState().setSelectedHmmState(stateId)
              useStore.getState().setActiveView('dashboard')
            }}
          />
          <StateGridControls
            sortBy={grid.sortBy}
            sortDirection={grid.sortDirection}
            minFlowCount={grid.minFlowCount}
            tacticFilter={grid.tacticFilter}
            onSortByChange={grid.setSortBy}
            onSortDirectionToggle={grid.toggleSortDirection}
            onMinFlowCountChange={grid.setMinFlowCount}
            onTacticFilterChange={grid.setTacticFilter}
          />
          <div className="flex-1 overflow-auto p-4">
            {/* Comparison instruction */}
            {grid.comparisonStates && grid.comparisonStates[1] === -1 && (
              <div className="mb-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 text-sm text-blue-700 dark:text-blue-400">
                Select another state to compare with State {grid.comparisonStates[0]}
              </div>
            )}

            {/* Comparison view */}
            {grid.comparisonStates && grid.comparisonStates[1] !== -1 && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium">State Comparison</h3>
                  <button
                    onClick={grid.clearComparison}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Close ✕
                  </button>
                </div>
                <StateComparison
                  state1={hmmStates.find((s) => s.stateId === grid.comparisonStates![0])!}
                  state2={hmmStates.find((s) => s.stateId === grid.comparisonStates![1])!}
                />
              </div>
            )}

            {/* State grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {grid.filteredAndSortedStates.map((state) => (
                <StateCard
                  key={state.stateId}
                  state={state}
                  assignedTactic={tacticAssignments[state.stateId]}
                  onTacticAssign={handleTacticAssign}
                  expanded={expandedState === state.stateId}
                  onToggleExpand={() => handleToggleExpand(state.stateId)}
                  selectedForComparison={
                    grid.comparisonStates
                      ? grid.comparisonStates[0] === state.stateId || grid.comparisonStates[1] === state.stateId
                      : false
                  }
                  onToggleCompare={() => grid.toggleCompare(state.stateId)}
                />
              ))}
            </div>
          </div>
          {/* Analysis panels */}
          {(transitions.length > 0 || temporalBuckets.length > 0) && (
            <div className="px-4 pb-2 grid grid-cols-1 lg:grid-cols-2 gap-4">
              {transitions.length > 0 && (
                <StateTransitions transitions={transitions} nStates={hmmStates.length} />
              )}
              {temporalBuckets.length > 0 && (
                <StateTemporal buckets={temporalBuckets} nStates={hmmStates.length} />
              )}
            </div>
          )}

          <div className="px-4 py-3 border-t border-border flex gap-2">
            <button
              onClick={handleSaveAll}
              className="px-4 py-2 text-sm font-medium rounded bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Save All Labels
            </button>
            <button
              onClick={handleExportJson}
              className="px-4 py-2 text-sm font-medium rounded border border-border hover:bg-accent"
            >
              Export JSON
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
    </ErrorBoundary>
  )
}
