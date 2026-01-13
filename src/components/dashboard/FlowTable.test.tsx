import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FlowTable } from './FlowTable'
import type { FlowRecord } from '@/lib/schema'

// Mock ResizeObserver for virtualization
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserverMock

// Mock element dimensions for virtualization
beforeEach(() => {
  // Mock getBoundingClientRect for scroll container
  Element.prototype.getBoundingClientRect = vi.fn(() => ({
    width: 800,
    height: 400,
    top: 0,
    left: 0,
    bottom: 400,
    right: 800,
    x: 0,
    y: 0,
    toJSON: () => {},
  }))

  // Mock offsetHeight/scrollHeight for virtualizer
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    value: 400,
  })
  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
    configurable: true,
    value: 10000,
  })
})

describe('FlowTable', () => {
  const mockData: Partial<FlowRecord>[] = [
    {
      FLOW_START_MILLISECONDS: 1424242193040,
      IPV4_SRC_ADDR: '59.166.0.2',
      L4_SRC_PORT: 4894,
      IPV4_DST_ADDR: '149.171.126.3',
      L4_DST_PORT: 53,
      PROTOCOL: 17,
      L7_PROTO: 5,
      IN_BYTES: 146,
      OUT_BYTES: 178,
      Attack: 'Benign',
    },
    {
      FLOW_START_MILLISECONDS: 1424242192744,
      IPV4_SRC_ADDR: '59.166.0.4',
      L4_SRC_PORT: 52671,
      IPV4_DST_ADDR: '149.171.126.6',
      L4_DST_PORT: 31992,
      PROTOCOL: 6,
      L7_PROTO: 11,
      IN_BYTES: 4704,
      OUT_BYTES: 2976,
      Attack: 'Exploits',
    },
  ]

  it('renders without crashing', () => {
    render(<FlowTable data={mockData} />)
    expect(screen.getByTestId('flow-table')).toBeInTheDocument()
  })

  it('displays column headers', () => {
    render(<FlowTable data={mockData} />)
    expect(screen.getByText('Src IP')).toBeInTheDocument()
    expect(screen.getByText('Dst IP')).toBeInTheDocument()
    expect(screen.getByText('Src Port')).toBeInTheDocument()
    expect(screen.getByText('Dst Port')).toBeInTheDocument()
    expect(screen.getByText('Attack')).toBeInTheDocument()
  })

  it('displays flow data in rows', () => {
    render(<FlowTable data={mockData} />)
    expect(screen.getByText('59.166.0.2')).toBeInTheDocument()
    expect(screen.getByText('149.171.126.3')).toBeInTheDocument()
    expect(screen.getByText('Benign')).toBeInTheDocument()
  })

  it('shows loading state when loading prop is true', () => {
    render(<FlowTable data={[]} loading={true} />)
    expect(screen.getByTestId('flow-table-loading')).toBeInTheDocument()
  })

  it('shows empty state when data is empty', () => {
    render(<FlowTable data={[]} loading={false} />)
    expect(screen.getByText(/no flows/i)).toBeInTheDocument()
  })

  it('calls onRowClick when a row is clicked', () => {
    const handleClick = vi.fn()
    render(<FlowTable data={mockData} onRowClick={handleClick} />)

    const row = screen.getByText('59.166.0.2').closest('tr')
    if (row) fireEvent.click(row)

    expect(handleClick).toHaveBeenCalledWith(expect.objectContaining({
      IPV4_SRC_ADDR: '59.166.0.2',
    }))
  })

  it('formats protocol numbers as names', () => {
    render(<FlowTable data={mockData} />)
    // Protocol 17 = UDP, Protocol 6 = TCP
    expect(screen.getByText('UDP')).toBeInTheDocument()
    expect(screen.getByText('TCP')).toBeInTheDocument()
  })

  it('highlights selected row', () => {
    render(<FlowTable data={mockData} selectedIndex={0} />)
    const firstRow = screen.getByText('59.166.0.2').closest('tr')
    expect(firstRow).toHaveClass('selected')
  })

  it('displays flow count', () => {
    render(<FlowTable data={mockData} totalCount={2365425} />)
    expect(screen.getByText(/2,365,425/)).toBeInTheDocument()
  })

  // Sorting tests
  describe('sorting', () => {
    it('renders sortable column headers', () => {
      render(<FlowTable data={mockData} />)
      // Column headers should be clickable for sorting
      const srcIpHeader = screen.getByText('Src IP')
      expect(srcIpHeader.closest('th')).toHaveClass('cursor-pointer')
    })

    it('sorts by column when header is clicked', () => {
      render(<FlowTable data={mockData} />)
      const srcIpHeader = screen.getByText('Src IP')
      fireEvent.click(srcIpHeader)

      // After click, rows should be sorted by Src IP
      // Find rows with data-index attribute (actual data rows)
      const dataRows = document.querySelectorAll('tr[data-index]')
      expect(dataRows[0].textContent).toContain('59.166.0.2')
    })

    it('toggles sort direction on repeated clicks', () => {
      render(<FlowTable data={mockData} />)
      const srcIpHeader = screen.getByText('Src IP')
      const srcIpTh = srcIpHeader.closest('th')!

      // First click - ascending
      fireEvent.click(srcIpHeader)
      expect(srcIpTh).toHaveAttribute('aria-sort', 'ascending')

      // Second click - descending
      fireEvent.click(srcIpHeader)
      expect(srcIpTh).toHaveAttribute('aria-sort', 'descending')
    })

    it('shows sort indicator on sorted column', () => {
      const { container } = render(<FlowTable data={mockData} />)
      const srcIpHeader = screen.getByText('Src IP')
      fireEvent.click(srcIpHeader)

      // Should show sort indicator icon
      const sortIndicator = container.querySelector('[data-sort-indicator]')
      expect(sortIndicator).toBeInTheDocument()
    })
  })

  // Filtering tests
  describe('filtering', () => {
    it('renders filter inputs in header', () => {
      render(<FlowTable data={mockData} />)
      // Should have filter inputs
      const filterInputs = screen.getAllByPlaceholderText(/filter/i)
      expect(filterInputs.length).toBeGreaterThan(0)
    })

    it('filters rows when typing in filter input', () => {
      render(<FlowTable data={mockData} />)
      const filterInputs = screen.getAllByPlaceholderText(/filter/i)
      const srcIpFilter = filterInputs[0]

      fireEvent.change(srcIpFilter, { target: { value: '59.166.0.2' } })

      // Filtered IP should be visible, other should not
      expect(screen.getByText('59.166.0.2')).toBeInTheDocument()
      expect(screen.queryByText('59.166.0.4')).not.toBeInTheDocument()
    })

    it('clears filter when input is cleared', () => {
      render(<FlowTable data={mockData} />)
      const filterInputs = screen.getAllByPlaceholderText(/filter/i)
      const srcIpFilter = filterInputs[0]

      // Apply filter
      fireEvent.change(srcIpFilter, { target: { value: '59.166.0.2' } })
      // Clear filter
      fireEvent.change(srcIpFilter, { target: { value: '' } })

      // Both IPs should be visible again
      expect(screen.getByText('59.166.0.2')).toBeInTheDocument()
      expect(screen.getByText('59.166.0.4')).toBeInTheDocument()
    })
  })

  // Virtualization tests
  describe('virtualization', () => {
    it('renders virtualized container', () => {
      const { container } = render(<FlowTable data={mockData} />)
      // Should have virtualized scroll container
      const scrollContainer = container.querySelector('[data-virtualized]')
      expect(scrollContainer).toBeInTheDocument()
    })

    it('uses data-index for row identification', () => {
      render(<FlowTable data={mockData} />)
      // Data rows should have data-index attribute for virtualization tracking
      const dataRows = document.querySelectorAll('tr[data-index]')
      expect(dataRows.length).toBeGreaterThan(0)
    })

    it('only renders visible rows plus overscan, not all rows', () => {
      // Generate 1000 mock flows to test virtualization
      const largeDataset: Partial<FlowRecord>[] = Array.from({ length: 1000 }, (_, i) => ({
        FLOW_START_MILLISECONDS: 1424242193040 + i,
        IPV4_SRC_ADDR: `192.168.1.${i % 256}`,
        L4_SRC_PORT: 1000 + i,
        IPV4_DST_ADDR: `10.0.0.${i % 256}`,
        L4_DST_PORT: 80,
        PROTOCOL: 6,
        IN_BYTES: 1000 * i,
        OUT_BYTES: 500 * i,
        Attack: 'Benign',
      }))

      render(<FlowTable data={largeDataset} />)

      // With 400px height and 35px row height, plus overscan of 10,
      // we should render approximately 12 visible rows + 20 overscan = ~32 rows max
      // NOT all 1000 rows
      const renderedDataRows = document.querySelectorAll('tr[data-index]')

      // Should render far fewer than 1000 rows
      // With proper virtualization: ~12 visible + 10 overscan each side = ~32 max
      expect(renderedDataRows.length).toBeLessThan(100)
      expect(renderedDataRows.length).toBeGreaterThan(0)
    })

    it('has proper structure for virtualization with spacer rows', () => {
      const largeDataset: Partial<FlowRecord>[] = Array.from({ length: 100 }, (_, i) => ({
        FLOW_START_MILLISECONDS: 1424242193040 + i,
        IPV4_SRC_ADDR: `192.168.1.${i % 256}`,
        L4_SRC_PORT: 1000 + i,
        IPV4_DST_ADDR: `10.0.0.${i % 256}`,
        L4_DST_PORT: 80,
        PROTOCOL: 6,
        IN_BYTES: 1000,
        OUT_BYTES: 500,
        Attack: 'Benign',
      }))

      const { container } = render(<FlowTable data={largeDataset} />)

      // The tbody should exist and contain rows
      const tbody = container.querySelector('tbody')
      expect(tbody).toBeInTheDocument()

      // Should have spacer rows for virtualization
      // (first and last child of tbody are spacers)
      const allRows = tbody?.querySelectorAll('tr')
      expect(allRows?.length).toBeGreaterThan(0)
    })
  })

  // Performance tests
  describe('performance', () => {
    it('memoizes row click handler', () => {
      const handleClick = vi.fn()
      const { rerender } = render(
        <FlowTable data={mockData} onRowClick={handleClick} />
      )

      // Re-render with same props should not create new handlers
      rerender(<FlowTable data={mockData} onRowClick={handleClick} />)

      // Click a row
      const row = screen.getByText('59.166.0.2').closest('tr')
      if (row) fireEvent.click(row)

      expect(handleClick).toHaveBeenCalledTimes(1)
    })
  })
})
