import { useEffect, useState, useCallback, memo, useMemo } from 'react'
import { getAttackSessions, getKillChainPhases } from '@/lib/motherduck/queries'
import type { AttackSession, KillChainPhase } from '@/lib/motherduck/types'
import { ATTACK_COLORS, MITRE_TECHNIQUES } from '@/lib/schema'
import { cn } from '@/lib/utils'

// MITRE ATT&CK Kill Chain order (left to right)
const KILL_CHAIN_ORDER = [
  'Reconnaissance',
  'Initial Access',
  'Execution',
  'Persistence',
  'Privilege Escalation',
  'Defense Evasion',
  'Credential Access',
  'Discovery',
  'Lateral Movement',
  'Collection',
  'Command and Control',
  'Exfiltration',
  'Impact',
]

// Pure utility functions - moved outside component to avoid recreation
function formatTime(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getTacticPosition(tactic: string): number {
  const idx = KILL_CHAIN_ORDER.indexOf(tactic)
  return idx >= 0 ? idx : KILL_CHAIN_ORDER.length
}

function sortTactics(tactics: string[]): string[] {
  return [...tactics].sort((a, b) => getTacticPosition(a) - getTacticPosition(b))
}

interface KillChainTimelineProps {
  onSessionSelect?: (session: AttackSession) => void
  className?: string
}

interface SessionItemProps {
  session: AttackSession
  isSelected: boolean
  onClick: (session: AttackSession) => void
}

/**
 * Memoized session item - only re-renders when session data or selection changes.
 */
const SessionItem = memo(function SessionItem({
  session,
  isSelected,
  onClick,
}: SessionItemProps) {
  // Memoize sorted tactics to avoid re-sorting on every render
  const sortedTactics = useMemo(
    () => sortTactics(session.tactics || []),
    [session.tactics]
  )

  return (
    <div
      className={cn(
        'p-3 border-b border-border cursor-pointer hover:bg-muted/50 transition-colors',
        isSelected && 'bg-muted'
      )}
      onClick={() => onClick(session)}
    >
      {/* Session Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="font-mono text-sm">{session.src_ip}</div>
        <div className="text-xs text-muted-foreground">
          {session.flow_count} flows &middot; {Math.round(session.duration_minutes)}m
        </div>
      </div>

      {/* Time Range */}
      <div className="text-xs text-muted-foreground mb-2">
        {formatTime(session.start_time)} → {formatTime(session.end_time)}
      </div>

      {/* Tactic Pills (Kill Chain Order) */}
      <div className="flex flex-wrap gap-1">
        {sortedTactics.map((tactic) => (
          <span
            key={tactic}
            className="px-2 py-0.5 rounded text-xs text-white/90"
            style={{ backgroundColor: ATTACK_COLORS[tactic] || '#71717a' }}
          >
            {tactic}
          </span>
        ))}
      </div>

      {/* Technique IDs */}
      {(session.techniques?.length ?? 0) > 0 && (
        <div className="mt-1 text-xs text-muted-foreground">
          {(session.techniques || []).map((t) => (
            <span key={t} className="mr-2" title={MITRE_TECHNIQUES[t]?.name || t}>
              {t}
            </span>
          ))}
        </div>
      )}

      {/* Target Summary */}
      <div className="mt-1 text-xs text-muted-foreground">
        → {(session.target_ips || []).slice(0, 3).join(', ')}
        {(session.target_ips?.length ?? 0) > 3 && ` +${session.target_ips.length - 3} more`}
      </div>
    </div>
  )
})

/**
 * Kill Chain Timeline - visualizes attack sessions with MITRE ATT&CK tactic progression.
 */
export function KillChainTimeline({ onSessionSelect, className }: KillChainTimelineProps) {
  const [sessions, setSessions] = useState<AttackSession[]>([])
  const [selectedSession, setSelectedSession] = useState<AttackSession | null>(null)
  const [phases, setPhases] = useState<KillChainPhase[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load attack sessions on mount
  useEffect(() => {
    async function loadSessions() {
      setLoading(true)
      setError(null)
      try {
        const data = await getAttackSessions(30, 2, 20)
        setSessions(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load sessions')
      } finally {
        setLoading(false)
      }
    }
    loadSessions()
  }, [])

  // Load phases when a session is selected
  const handleSessionClick = useCallback(async (session: AttackSession) => {
    setSelectedSession(session)
    onSessionSelect?.(session)
    try {
      const data = await getKillChainPhases(
        session.src_ip,
        session.start_time,
        session.end_time
      )
      setPhases(data)
    } catch (err) {
      console.error('Failed to load phases:', err)
      setPhases([])
    }
  }, [onSessionSelect])

  if (loading) {
    return (
      <div className={cn('p-4 text-muted-foreground', className)}>
        Loading attack sessions...
      </div>
    )
  }

  if (error) {
    return (
      <div className={cn('p-4 text-destructive', className)}>
        Error: {error}
      </div>
    )
  }

  if (sessions.length === 0) {
    return (
      <div className={cn('p-4 text-muted-foreground', className)}>
        No multi-tactic attack sessions found.
        <br />
        <span className="text-xs">
          Sessions require 2+ distinct MITRE ATT&CK tactics within a 30-minute window.
        </span>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="px-4 py-2 border-b border-border">
        <h2 className="text-sm font-semibold">Attack Sessions (Kill Chain)</h2>
        <p className="text-xs text-muted-foreground">
          {sessions.length} sessions with multi-tactic progression
        </p>
      </div>

      {/* Kill Chain Legend */}
      <div className="px-4 py-2 border-b border-border overflow-x-auto">
        <div className="flex gap-1 text-[10px] whitespace-nowrap">
          {KILL_CHAIN_ORDER.map((tactic) => (
            <div
              key={tactic}
              className="px-1.5 py-0.5 rounded text-white/90"
              style={{ backgroundColor: ATTACK_COLORS[tactic] || '#71717a' }}
            >
              {tactic.replace(' ', '\n').split(' ')[0]}
            </div>
          ))}
        </div>
      </div>

      {/* Sessions List */}
      <div className="flex-1 overflow-y-auto">
        {sessions.map((session) => (
          <SessionItem
            key={session.session_id}
            session={session}
            isSelected={selectedSession?.session_id === session.session_id}
            onClick={handleSessionClick}
          />
        ))}
      </div>

      {/* Phase Details Panel (when session selected) */}
      {selectedSession && phases.length > 0 && (
        <div className="border-t border-border p-3 bg-muted/30 max-h-48 overflow-y-auto">
          <h3 className="text-sm font-semibold mb-2">
            Kill Chain Phases: {selectedSession.src_ip}
          </h3>
          <div className="space-y-2">
            {phases.map((phase, idx) => (
              <div key={idx} className="flex items-start gap-2 text-xs">
                {/* Phase Number */}
                <div className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold shrink-0">
                  {idx + 1}
                </div>
                {/* Phase Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="px-1.5 py-0.5 rounded text-white/90"
                      style={{ backgroundColor: ATTACK_COLORS[phase.tactic] || '#71717a' }}
                    >
                      {phase.tactic}
                    </span>
                    <span className="font-mono text-muted-foreground">
                      {phase.technique}
                    </span>
                    {MITRE_TECHNIQUES[phase.technique] && (
                      <a
                        href={MITRE_TECHNIQUES[phase.technique].url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        ↗
                      </a>
                    )}
                  </div>
                  <div className="text-muted-foreground mt-0.5">
                    {phase.flow_count} flows →{' '}
                    {(phase.target_ips || []).slice(0, 2).join(', ')}
                    {(phase.target_ips?.length ?? 0) > 2 && ` +${phase.target_ips.length - 2}`}
                  </div>
                </div>
                {/* Timing */}
                <div className="text-muted-foreground text-right shrink-0">
                  {formatTime(phase.phase_start)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
