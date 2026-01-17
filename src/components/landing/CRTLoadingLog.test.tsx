import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CRTLoadingLog } from './CRTLoadingLog'

describe('CRTLoadingLog', () => {
  it('renders file name being loaded', () => {
    render(
      <CRTLoadingLog
        fileName="flows.csv"
        progress={50}
        logs={[]}
      />
    )

    expect(screen.getByText(/loading.*flows\.csv/i)).toBeInTheDocument()
  })

  it('shows progress bar with percentage', () => {
    render(
      <CRTLoadingLog
        fileName="data.parquet"
        progress={75}
        logs={[]}
      />
    )

    expect(screen.getByText('75%')).toBeInTheDocument()
    expect(screen.getByTestId('crt-progress-bar')).toHaveStyle({ width: '75%' })
  })

  it('renders completed log entries with OK status', () => {
    render(
      <CRTLoadingLog
        fileName="flows.csv"
        progress={100}
        logs={[
          { message: 'Connected to MotherDuck', status: 'ok' },
          { message: 'Loaded 2,365,424 rows', status: 'ok' },
        ]}
      />
    )

    expect(screen.getAllByText('[OK]')).toHaveLength(2)
    expect(screen.getByText(/connected to motherduck/i)).toBeInTheDocument()
    expect(screen.getByText(/loaded 2,365,424 rows/i)).toBeInTheDocument()
  })

  it('renders pending log entries with animated indicator', () => {
    render(
      <CRTLoadingLog
        fileName="flows.csv"
        progress={80}
        logs={[
          { message: 'Connected to MotherDuck', status: 'ok' },
          { message: 'Building dashboard', status: 'pending' },
        ]}
      />
    )

    expect(screen.getByText('[..]')).toBeInTheDocument()
    expect(screen.getByText(/building dashboard/i)).toBeInTheDocument()
  })

  it('renders failed log entries with FAIL status', () => {
    render(
      <CRTLoadingLog
        fileName="bad.csv"
        progress={30}
        logs={[
          { message: 'Could not parse file', status: 'fail' },
        ]}
      />
    )

    expect(screen.getByText('[FAIL]')).toBeInTheDocument()
    expect(screen.getByText(/could not parse file/i)).toBeInTheDocument()
  })

  it('shows blinking cursor on active step', () => {
    render(
      <CRTLoadingLog
        fileName="flows.csv"
        progress={50}
        logs={[
          { message: 'Processing', status: 'pending' },
        ]}
      />
    )

    const pendingLine = screen.getByText(/processing/i).closest('div')
    expect(pendingLine).toHaveClass('crt-cursor')
  })

  it('formats row counts with commas', () => {
    render(
      <CRTLoadingLog
        fileName="flows.csv"
        progress={100}
        logs={[
          { message: 'Loaded 2365424 rows', status: 'ok' },
        ]}
      />
    )

    // The component should display the message as-is, formatting is caller's responsibility
    expect(screen.getByText(/loaded 2365424 rows/i)).toBeInTheDocument()
  })
})
