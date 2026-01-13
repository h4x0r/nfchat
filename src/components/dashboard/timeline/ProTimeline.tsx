import { useEffect, useRef, useMemo, useCallback } from 'react'
import { useStore } from '@/lib/store'
import { useContainerDimensions } from '@/hooks/useContainerDimensions'
import { PREMIERE_COLORS, TIMELINE_CONFIG } from './constants'
import { pixelToTime, timeToPercent } from './utils'
import { TimecodeDisplay } from './TimecodeDisplay'
import { TimeRuler } from './TimeRuler'
import { Playhead } from './Playhead'
import { PlaybackControls } from './PlaybackControls'
import type { ProTimelineProps } from './types'

// Recharts for data visualization
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface TimelineDataPoint {
  time: number
  attack: string
  count: number
}

/**
 * Aggregate data points for visualization (group by time bucket)
 */
function aggregateData(data: TimelineDataPoint[]): { time: number; count: number }[] {
  const byTime = new Map<number, number>()
  for (const point of data) {
    byTime.set(point.time, (byTime.get(point.time) || 0) + point.count)
  }
  return Array.from(byTime.entries())
    .map(([time, count]) => ({ time, count }))
    .sort((a, b) => a.time - b.time)
}

/**
 * Professional Premiere Pro-style timeline with playback controls,
 * timecode display, and data visualization.
 */
export function ProTimeline({
  data,
  markers = [],
  loading = false,
  onTimeChange,
  onMarkerClick,
}: ProTimelineProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const animationRef = useRef<number | undefined>(undefined)
  const lastTickRef = useRef<number>(0)

  // Use ResizeObserver-based hook for reliable dimension tracking
  const { setRef: setContainerRef, isReady: containerReady, width: trackWidth } = useContainerDimensions()

  // Combined ref callback that sets both refs
  const setTrackRef = useCallback((el: HTMLDivElement | null) => {
    trackRef.current = el
    setContainerRef(el)
  }, [setContainerRef])

  // Zustand store
  const playback = useStore((s) => s.playback)
  const setIsPlaying = useStore((s) => s.setIsPlaying)
  const setCurrentTime = useStore((s) => s.setCurrentTime)
  const setPlaybackSpeed = useStore((s) => s.setPlaybackSpeed)
  const setPlaybackDuration = useStore((s) => s.setPlaybackDuration)

  // Compute time range from data
  const timeRange = useMemo(() => {
    if (data.length === 0) return { start: 0, end: 0 }
    const times = data.map((d) => d.time)
    return { start: Math.min(...times), end: Math.max(...times) }
  }, [data])

  // Set duration when data changes
  useEffect(() => {
    const duration = timeRange.end - timeRange.start
    if (duration > 0) {
      setPlaybackDuration(duration)
      setCurrentTime(timeRange.start)
    }
  }, [timeRange, setPlaybackDuration, setCurrentTime])

  // Aggregated data for chart
  const chartData = useMemo(() => aggregateData(data), [data])

  // Playback animation loop
  useEffect(() => {
    if (!playback.isPlaying) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      return
    }

    const tick = (timestamp: number) => {
      if (lastTickRef.current === 0) {
        lastTickRef.current = timestamp
      }

      const delta = timestamp - lastTickRef.current
      lastTickRef.current = timestamp

      const newTime = playback.currentTime + delta * playback.speed

      // Check if we've reached the end
      const endTime = playback.outPoint ?? timeRange.end
      if (newTime >= endTime) {
        setCurrentTime(playback.inPoint ?? timeRange.start)
        // Could also stop playing here if desired
      } else {
        setCurrentTime(newTime)
        onTimeChange?.(newTime)
      }

      animationRef.current = requestAnimationFrame(tick)
    }

    lastTickRef.current = 0
    animationRef.current = requestAnimationFrame(tick)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [
    playback.isPlaying,
    playback.speed,
    playback.currentTime,
    playback.inPoint,
    playback.outPoint,
    timeRange,
    setCurrentTime,
    onTimeChange,
  ])

  // Handle click on track to seek
  const handleTrackClick = useCallback(
    (e: React.MouseEvent) => {
      if (!trackRef.current) return

      const rect = trackRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const time = pixelToTime(x, rect.width, timeRange.start, timeRange.end)

      setCurrentTime(time)
      onTimeChange?.(time)
    },
    [timeRange, setCurrentTime, onTimeChange]
  )

  // Handle playhead drag
  const handlePlayheadDrag = useCallback(
    (clientX: number) => {
      if (!trackRef.current) return

      const rect = trackRef.current.getBoundingClientRect()
      const x = clientX - rect.left
      const time = pixelToTime(x, rect.width, timeRange.start, timeRange.end)

      setCurrentTime(time)
      onTimeChange?.(time)
    },
    [timeRange, setCurrentTime, onTimeChange]
  )

  const handlePlayPause = () => setIsPlaying(!playback.isPlaying)
  const handleRewind = () => {
    setCurrentTime(playback.inPoint ?? timeRange.start)
    onTimeChange?.(playback.inPoint ?? timeRange.start)
  }

  const playheadPosition = timeToPercent(
    playback.currentTime,
    timeRange.start,
    timeRange.end
  )

  // Use width from hook, with fallback for initial render
  const rulerWidth = trackWidth > 0 ? trackWidth : 800

  if (loading) {
    return (
      <div
        className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg flex items-center justify-center"
        style={{ height: 200 }}
      >
        <span style={{ color: PREMIERE_COLORS.textDim }}>Loading timeline...</span>
      </div>
    )
  }

  return (
    <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg overflow-hidden">
      {/* Controls bar */}
      <div
        className="flex items-center justify-between px-3 border-b border-[#2a2a2a]"
        style={{
          height: TIMELINE_CONFIG.controlsHeight,
          backgroundColor: PREMIERE_COLORS.panelBg,
        }}
      >
        <PlaybackControls
          isPlaying={playback.isPlaying}
          speed={playback.speed}
          disabled={data.length === 0}
          onPlayPause={handlePlayPause}
          onRewind={handleRewind}
          onSpeedChange={setPlaybackSpeed}
        />

        <TimecodeDisplay
          currentTime={playback.currentTime - timeRange.start}
          duration={playback.duration}
          inPoint={playback.inPoint ? playback.inPoint - timeRange.start : null}
          outPoint={playback.outPoint ? playback.outPoint - timeRange.start : null}
        />
      </div>

      {/* Time ruler */}
      <TimeRuler
        startTime={timeRange.start}
        endTime={timeRange.end}
        width={rulerWidth}
      />

      {/* Track area with visualization */}
      <div
        ref={setTrackRef}
        data-timeline-track
        className="relative cursor-crosshair"
        style={{
          height: TIMELINE_CONFIG.trackHeight,
          backgroundColor: PREMIERE_COLORS.trackBg,
        }}
        onClick={handleTrackClick}
      >
        {/* Chart visualization - only render when container has dimensions */}
        {containerReady && chartData.length > 0 && (
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <AreaChart
              data={chartData}
              margin={{ top: 5, right: 0, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={PREMIERE_COLORS.playhead} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={PREMIERE_COLORS.playhead} stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <XAxis dataKey="time" hide />
              <YAxis hide />
              <Tooltip
                contentStyle={{
                  backgroundColor: PREMIERE_COLORS.panelBg,
                  border: `1px solid ${PREMIERE_COLORS.border}`,
                  borderRadius: 4,
                }}
                labelStyle={{ color: PREMIERE_COLORS.text }}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke={PREMIERE_COLORS.playhead}
                strokeWidth={1}
                fill="url(#chartGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}

        {/* Playhead */}
        <Playhead
          position={playheadPosition}
          visible={data.length > 0}
          onDrag={handlePlayheadDrag}
        />

        {/* Markers */}
        {markers.map((marker) => {
          const pos = timeToPercent(marker.time, timeRange.start, timeRange.end)
          return (
            <div
              key={marker.id}
              className="absolute top-0 bottom-0 cursor-pointer"
              style={{
                left: `${pos}%`,
                width: 4,
                backgroundColor: PREMIERE_COLORS.severity[marker.severity],
                opacity: 0.8,
              }}
              onClick={(e) => {
                e.stopPropagation()
                onMarkerClick?.(marker)
              }}
              title={marker.label}
            />
          )
        })}
      </div>
    </div>
  )
}
