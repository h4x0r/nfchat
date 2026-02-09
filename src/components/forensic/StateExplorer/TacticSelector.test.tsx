import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TacticSelector } from './TacticSelector'

describe('TacticSelector', () => {
  const defaultProps = {
    stateId: 0,
    assignedTactic: undefined as string | undefined,
    onAssign: vi.fn(),
  }

  it('renders a select trigger', () => {
    render(<TacticSelector {...defaultProps} />)
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('shows "Unassigned" when no tactic assigned', () => {
    render(<TacticSelector {...defaultProps} />)
    const select = screen.getByRole('combobox') as HTMLSelectElement
    expect(select.value).toBe('')
    expect(screen.getByText('Unassigned')).toBeInTheDocument()
  })

  it('shows assigned tactic when provided', () => {
    render(<TacticSelector {...defaultProps} assignedTactic="Exfiltration" />)
    const select = screen.getByRole('combobox') as HTMLSelectElement
    expect(select.value).toBe('Exfiltration')
  })

  it('calls onAssign when a tactic is selected', async () => {
    const user = userEvent.setup()
    const onAssign = vi.fn()
    render(<TacticSelector {...defaultProps} onAssign={onAssign} />)

    await user.selectOptions(screen.getByRole('combobox'), 'Exfiltration')

    expect(onAssign).toHaveBeenCalledWith(0, 'Exfiltration')
  })

  it('calls onAssign with empty string when Unassigned is selected', async () => {
    const user = userEvent.setup()
    const onAssign = vi.fn()
    render(<TacticSelector {...defaultProps} assignedTactic="Reconnaissance" onAssign={onAssign} />)

    await user.selectOptions(screen.getByRole('combobox'), '')

    expect(onAssign).toHaveBeenCalledWith(0, '')
  })

  it('passes correct stateId to onAssign', async () => {
    const user = userEvent.setup()
    const onAssign = vi.fn()
    render(<TacticSelector stateId={5} onAssign={onAssign} />)

    await user.selectOptions(screen.getByRole('combobox'), 'Lateral Movement')

    expect(onAssign).toHaveBeenCalledWith(5, 'Lateral Movement')
  })
})
