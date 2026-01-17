import { useState, useMemo, useRef, useCallback, memo, useEffect } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type OnChangeFn,
} from '@tanstack/react-table'
import { Loader2, ArrowUp, ArrowDown, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PROTOCOL_NAMES, ATTACK_COLORS, ATTACK_TYPES, type AttackType } from '@/lib/schema'
import { MultiSelectFilter, type FilterOption } from './MultiSelectFilter'

// Attack filter options with colors
const ATTACK_FILTER_OPTIONS: FilterOption[] = ATTACK_TYPES.map((attack) => ({
  value: attack,
  label: attack,
  color: ATTACK_COLORS[attack],
}))
import type { FlowRecord } from '@/lib/schema'

interface FlowTableProps {
  data: Partial<FlowRecord>[]
  loading?: boolean
  onRowClick?: (flow: Partial<FlowRecord>) => void
  onCellClick?: (column: string, value: string) => void
  selectedIndex?: number
  totalCount?: number
  // Pagination props
  currentPage?: number
  totalPages?: number
  onPageChange?: (page: number) => void
  // Controlled column filters for server-side filtering
  columnFilters?: ColumnFiltersState
  onColumnFiltersChange?: OnChangeFn<ColumnFiltersState>
}

// Memoized row component to prevent unnecessary re-renders
const VirtualRow = memo(function VirtualRow({
  row,
  virtualRow,
  measureElement,
  isSelected,
  onClick,
  onCellClick,
}: {
  row: ReturnType<ReturnType<typeof useReactTable<Partial<FlowRecord>>>['getRowModel']>['rows'][0]
  virtualRow: { index: number; start: number; size: number }
  measureElement: (el: HTMLTableRowElement | null) => void
  isSelected: boolean
  onClick: () => void
  onCellClick?: (column: string, value: string) => void
}) {
  return (
    <TableRow
      data-index={virtualRow.index}
      ref={measureElement}
      className={`cursor-pointer hover:bg-muted/50 ${
        isSelected ? 'selected bg-primary/10' : ''
      }`}
      onClick={onClick}
    >
      {row.getVisibleCells().map((cell) => {
        const columnId = cell.column.id
        const rawValue = cell.getValue()
        const stringValue = rawValue != null ? String(rawValue) : ''

        const handleCellClick = onCellClick
          ? (e: React.MouseEvent) => {
              e.stopPropagation()
              onCellClick(columnId, stringValue)
            }
          : undefined

        return (
          <TableCell key={cell.id} className="py-1">
            <span
              onClick={handleCellClick}
              className={onCellClick ? 'cursor-pointer hover:underline' : ''}
            >
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </span>
          </TableCell>
        )
      })}
    </TableRow>
  )
})

export function FlowTable({
  data,
  loading = false,
  onRowClick,
  onCellClick,
  selectedIndex,
  totalCount,
  currentPage,
  totalPages,
  onPageChange,
  columnFilters: controlledColumnFilters,
  onColumnFiltersChange,
}: FlowTableProps) {
  // Check if pagination is enabled
  const hasPagination = currentPage !== undefined && totalPages !== undefined && onPageChange !== undefined
  // Check if column filters are controlled externally (server-side filtering)
  const isControlled = controlledColumnFilters !== undefined && onColumnFiltersChange !== undefined
  // All hooks must be called unconditionally at the top
  const parentRef = useRef<HTMLDivElement>(null)
  const [sorting, setSorting] = useState<SortingState>([])
  const [internalColumnFilters, setInternalColumnFilters] = useState<ColumnFiltersState>([])

  // Use controlled or internal state
  const columnFilters = isControlled ? controlledColumnFilters : internalColumnFilters
  const setColumnFilters = isControlled ? onColumnFiltersChange : setInternalColumnFilters

  const columns = useMemo<ColumnDef<Partial<FlowRecord>>[]>(
    () => [
      {
        accessorKey: 'IPV4_SRC_ADDR',
        header: 'Src IP',
        cell: ({ getValue }) => (
          <span className="font-mono text-xs">{getValue<string>()}</span>
        ),
      },
      {
        accessorKey: 'L4_SRC_PORT',
        header: 'Src Port',
        cell: ({ getValue }) => (
          <span className="font-mono text-xs">{getValue<number>()}</span>
        ),
      },
      {
        accessorKey: 'IPV4_DST_ADDR',
        header: 'Dst IP',
        cell: ({ getValue }) => (
          <span className="font-mono text-xs">{getValue<string>()}</span>
        ),
      },
      {
        accessorKey: 'L4_DST_PORT',
        header: 'Dst Port',
        cell: ({ getValue }) => (
          <span className="font-mono text-xs">{getValue<number>()}</span>
        ),
      },
      {
        accessorKey: 'PROTOCOL',
        header: 'Proto',
        cell: ({ getValue }) => {
          const proto = getValue<number>()
          return (
            <span className="text-xs">
              {PROTOCOL_NAMES[proto] || proto}
            </span>
          )
        },
      },
      {
        accessorKey: 'IN_BYTES',
        header: 'In Bytes',
        cell: ({ getValue }) => (
          <span className="text-xs">{getValue<number>()?.toLocaleString()}</span>
        ),
      },
      {
        accessorKey: 'OUT_BYTES',
        header: 'Out Bytes',
        cell: ({ getValue }) => (
          <span className="text-xs">{getValue<number>()?.toLocaleString()}</span>
        ),
      },
      {
        accessorKey: 'Attack',
        header: 'Attack',
        cell: ({ getValue }) => {
          const attack = getValue<string>()
          const color = ATTACK_COLORS[attack as AttackType] || '#6b7280'
          return (
            <Badge
              variant="outline"
              style={{ borderColor: color, color }}
              className="text-xs"
            >
              {attack}
            </Badge>
          )
        },
        filterFn: (row, columnId, filterValue: string[]) => {
          if (!filterValue || filterValue.length === 0) return true
          const cellValue = row.getValue(columnId) as string
          return filterValue.includes(cellValue)
        },
      },
    ],
    []
  )

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      sorting,
      columnFilters,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
  })

  const { rows } = table.getRowModel()

  // Reset pagination to page 0 when filters change (uncontrolled mode only)
  // In controlled mode, ForensicDashboard handles this for server-side filtering
  useEffect(() => {
    if (!isControlled && currentPage !== undefined && currentPage > 0 && onPageChange) {
      onPageChange(0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [internalColumnFilters, isControlled])

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 35, // Estimated row height in pixels
    overscan: 10,
  })

  const virtualRows = virtualizer.getVirtualItems()
  const totalSize = virtualizer.getTotalSize()

  // Memoize the row click handler creator to avoid creating new functions
  const handleRowClick = useCallback(
    (flow: Partial<FlowRecord>) => {
      onRowClick?.(flow)
    },
    [onRowClick]
  )

  // Early returns after all hooks
  if (loading) {
    return (
      <div
        data-testid="flow-table-loading"
        className="flex items-center justify-center h-full"
      >
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div
        data-testid="flow-table"
        className="flex items-center justify-center h-full text-muted-foreground text-sm"
      >
        No flows to display
      </div>
    )
  }

  return (
    <div data-testid="flow-table" className="h-full flex flex-col">
      {totalCount !== undefined && (
        <div className="text-xs text-muted-foreground mb-2">
          Showing {data.length.toLocaleString()} of {totalCount.toLocaleString()} flows
        </div>
      )}
      <div
        ref={parentRef}
        data-virtualized
        className="flex-1 overflow-auto"
      >
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const isSorted = header.column.getIsSorted()
                  return (
                    <TableHead
                      key={header.id}
                      className="text-xs cursor-pointer select-none hover:bg-muted/50"
                      onClick={header.column.getToggleSortingHandler()}
                      aria-sort={
                        isSorted
                          ? isSorted === 'asc'
                            ? 'ascending'
                            : 'descending'
                          : undefined
                      }
                    >
                      <div className="flex items-center gap-1">
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                        {isSorted ? (
                          <span data-sort-indicator>
                            {isSorted === 'asc' ? (
                              <ArrowUp className="h-3 w-3" />
                            ) : (
                              <ArrowDown className="h-3 w-3" />
                            )}
                          </span>
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-30" />
                        )}
                      </div>
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
            {/* Filter row */}
            <TableRow>
              {table.getHeaderGroups()[0]?.headers.map((header) => (
                <TableHead key={`filter-${header.id}`} className="py-1 px-2">
                  {header.id === 'Attack' ? (
                    <MultiSelectFilter
                      options={ATTACK_FILTER_OPTIONS}
                      selected={(header.column.getFilterValue() as string[]) ?? []}
                      onChange={(values) => header.column.setFilterValue(values.length > 0 ? values : undefined)}
                      placeholder="Filter..."
                    />
                  ) : (
                    <input
                      type="text"
                      placeholder="Filter..."
                      value={(header.column.getFilterValue() as string) ?? ''}
                      onChange={(e) => header.column.setFilterValue(e.target.value)}
                      className="w-full text-xs px-1.5 py-0.5 border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Spacer for virtual scroll */}
            <tr style={{ height: `${virtualRows[0]?.start ?? 0}px` }} />
            {virtualRows.map((virtualRow) => {
              const row = rows[virtualRow.index]
              return (
                <VirtualRow
                  key={row.id}
                  row={row}
                  virtualRow={virtualRow}
                  measureElement={(el) => virtualizer.measureElement(el)}
                  isSelected={selectedIndex === virtualRow.index}
                  onClick={() => handleRowClick(row.original)}
                  onCellClick={onCellClick}
                />
              )
            })}
            {/* Bottom spacer */}
            <tr
              style={{
                height: `${totalSize - (virtualRows[virtualRows.length - 1]?.end ?? 0)}px`,
              }}
            />
          </TableBody>
        </Table>
      </div>
      {/* Pagination controls */}
      {hasPagination && (
        <div
          data-testid="pagination-controls"
          className="flex items-center justify-between px-4 py-2 border-t border-border bg-muted/30"
        >
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 0}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Prev
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {currentPage + 1} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages - 1}
            aria-label="Next page"
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  )
}
