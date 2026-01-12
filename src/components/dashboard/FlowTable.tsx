import { useState, useMemo, useRef } from 'react'
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
} from '@tanstack/react-table'
import { Loader2, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { PROTOCOL_NAMES, ATTACK_COLORS, type AttackType } from '@/lib/schema'
import type { FlowRecord } from '@/lib/schema'

interface FlowTableProps {
  data: Partial<FlowRecord>[]
  loading?: boolean
  onRowClick?: (flow: Partial<FlowRecord>) => void
  selectedIndex?: number
  totalCount?: number
}

export function FlowTable({
  data,
  loading = false,
  onRowClick,
  selectedIndex,
  totalCount,
}: FlowTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

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

  const parentRef = useRef<HTMLDivElement>(null)
  const { rows } = table.getRowModel()

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 32, // Estimated row height in pixels
    overscan: 10,
  })

  const virtualRows = virtualizer.getVirtualItems()
  const totalSize = virtualizer.getTotalSize()

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
                  <input
                    type="text"
                    placeholder="Filter..."
                    value={(header.column.getFilterValue() as string) ?? ''}
                    onChange={(e) => header.column.setFilterValue(e.target.value)}
                    className="w-full text-xs px-1.5 py-0.5 border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  />
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
                <TableRow
                  key={row.id}
                  data-index={virtualRow.index}
                  ref={(el) => virtualizer.measureElement(el)}
                  className={`cursor-pointer hover:bg-muted/50 ${
                    selectedIndex === virtualRow.index ? 'selected bg-primary/10' : ''
                  }`}
                  onClick={() => onRowClick?.(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-1">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
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
    </div>
  )
}
