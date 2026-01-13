import { MessageSquare, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProTimeline } from './dashboard/timeline'
import { AttackBreakdown } from './dashboard/AttackBreakdown'
import { TopTalkers } from './dashboard/TopTalkers'
import { FlowTable } from './dashboard/FlowTable'
import { useStore } from '@/lib/store'
import type { TimelineDataPoint } from './dashboard/timeline'

interface DashboardProps {
  loading?: boolean
  onChatToggle?: () => void
}

export function Dashboard({ loading = false, onChatToggle }: DashboardProps) {
  const {
    timelineData,
    attackBreakdown,
    topSrcIPs,
    topDstIPs,
    flows,
    totalFlowCount,
    selectedFlow,
    setSelectedFlow,
  } = useStore()

  if (loading) {
    return (
      <div
        data-testid="dashboard-loading"
        className="flex items-center justify-center h-screen bg-background"
      >
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading NetFlow data...</p>
        </div>
      </div>
    )
  }

  return (
    <div data-testid="dashboard" className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b px-4 py-3 flex items-center justify-between">
        <div className="flex flex-col">
          <h1 className="text-xl font-semibold">nfchat</h1>
          <span className="text-[10px] text-muted-foreground font-mono">
            {__COMMIT_HASH__} {__BUILD_TIME__}
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onChatToggle}
          className="gap-2"
        >
          <MessageSquare className="h-4 w-4" />
          Chat
        </Button>
      </header>

      {/* Main content */}
      <main className="flex-1 p-4 overflow-hidden">
        <div className="grid grid-cols-12 gap-4 h-full">
          {/* Left column - Timeline and Charts */}
          <div className="col-span-8 flex flex-col gap-4">
            {/* Timeline */}
            <div className="h-56">
              <ProTimeline
                data={timelineData as TimelineDataPoint[]}
                loading={loading}
              />
            </div>

            {/* Flow Table */}
            <div className="flex-1 border rounded-lg p-4 min-h-0">
              <h2 className="text-sm font-medium mb-2">Flow Records</h2>
              <div className="h-[calc(100%-2rem)]">
                <FlowTable
                  data={flows}
                  totalCount={totalFlowCount}
                  onRowClick={setSelectedFlow}
                  selectedIndex={
                    selectedFlow
                      ? flows.findIndex(
                          (f) =>
                            f.FLOW_START_MILLISECONDS ===
                            selectedFlow.FLOW_START_MILLISECONDS
                        )
                      : undefined
                  }
                />
              </div>
            </div>
          </div>

          {/* Right column - Stats */}
          <div className="col-span-4 flex flex-col gap-4 overflow-hidden">
            {/* Attack Breakdown */}
            <div className="h-64 border rounded-lg p-4 overflow-hidden">
              <h2 className="text-sm font-medium mb-2">Attack Types</h2>
              <div className="h-[calc(100%-2rem)] overflow-hidden">
                <AttackBreakdown data={attackBreakdown} />
              </div>
            </div>

            {/* Top Talkers */}
            <div className="flex-1 border rounded-lg p-4 min-h-0 overflow-hidden">
              <h2 className="text-sm font-medium mb-2">Top Talkers</h2>
              <div className="h-[calc(100%-2rem)] grid grid-rows-2 gap-2 overflow-hidden">
                <div className="overflow-hidden flex flex-col">
                  <p className="text-xs text-muted-foreground mb-1 flex-shrink-0">Source IPs</p>
                  <div className="flex-1 min-h-0">
                    <TopTalkers data={topSrcIPs} />
                  </div>
                </div>
                <div className="overflow-hidden flex flex-col">
                  <p className="text-xs text-muted-foreground mb-1 flex-shrink-0">Destination IPs</p>
                  <div className="flex-1 min-h-0">
                    <TopTalkers data={topDstIPs} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
