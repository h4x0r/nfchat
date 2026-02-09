import { ATTACK_COLORS } from '@/lib/schema'

const ALL_TACTICS = [
  '',
  'Reconnaissance',
  'Discovery',
  'Initial Access',
  'Execution',
  'Persistence',
  'Privilege Escalation',
  'Defense Evasion',
  'Credential Access',
  'Lateral Movement',
  'Collection',
  'Command and Control',
  'Exfiltration',
  'Impact',
  'Benign',
]

interface TacticSelectorProps {
  stateId: number
  assignedTactic?: string
  onAssign: (stateId: number, tactic: string) => void
}

export function TacticSelector({
  stateId,
  assignedTactic,
  onAssign,
}: TacticSelectorProps) {
  const currentTactic = assignedTactic || ''
  const tacticColor = currentTactic ? (ATTACK_COLORS[currentTactic] || '#71717a') : '#71717a'

  return (
    <select
      role="combobox"
      value={currentTactic}
      onChange={(e) => onAssign(stateId, e.target.value)}
      className="h-7 rounded border border-border bg-background px-2 text-xs font-medium"
      style={{ color: tacticColor }}
    >
      {ALL_TACTICS.map((tactic) => (
        <option key={tactic || '__unassigned'} value={tactic}>
          {tactic || 'Unassigned'}
        </option>
      ))}
    </select>
  )
}
