import type { PlaybackSpeed } from './constants'

/**
 * Playback state managed by the timeline
 */
export interface PlaybackState {
  isPlaying: boolean
  currentTime: number // milliseconds (timestamp in data range)
  speed: PlaybackSpeed
  duration: number // total duration in ms
  inPoint: number | null // A-B selection start
  outPoint: number | null // A-B selection end
}

/**
 * Timeline data point for visualization
 */
export interface TimelineDataPoint {
  time: number // timestamp in ms
  attack: string
  count: number
}

/**
 * Anomaly/event marker on the timeline
 */
export interface TimelineMarker {
  id: string
  time: number
  severity: 'normal' | 'elevated' | 'high' | 'severe'
  label: string
}

/**
 * Props for the main ProTimeline component
 */
export interface ProTimelineProps {
  data: TimelineDataPoint[]
  markers?: TimelineMarker[]
  loading?: boolean
  onTimeChange?: (time: number) => void
  onRegionChange?: (inPoint: number, outPoint: number) => void
  onMarkerClick?: (marker: TimelineMarker) => void
}

/**
 * Props for the TimecodeDisplay component
 */
export interface TimecodeDisplayProps {
  currentTime: number
  duration: number
  inPoint?: number | null
  outPoint?: number | null
  fps?: number
}

/**
 * Props for the TimeRuler component
 */
export interface TimeRulerProps {
  startTime: number
  endTime: number
  width: number
}

/**
 * Props for the Playhead component
 */
export interface PlayheadProps {
  position: number // percentage 0-100
  visible?: boolean
  onDragStart?: () => void
  onDrag?: (position: number) => void
  onDragEnd?: () => void
}

/**
 * Props for the PlaybackControls component
 */
export interface PlaybackControlsProps {
  isPlaying: boolean
  speed: PlaybackSpeed
  disabled?: boolean
  onPlayPause: () => void
  onRewind: () => void
  onSpeedChange: (speed: PlaybackSpeed) => void
}

/**
 * Props for the RegionSelector component
 */
export interface RegionSelectorProps {
  inPoint: number // percentage 0-100
  outPoint: number // percentage 0-100
  onInPointChange: (position: number) => void
  onOutPointChange: (position: number) => void
  onRegionDrag: (deltaPosition: number) => void
}

/**
 * Track drag state for mouse interactions
 */
export type DragTarget = 'playhead' | 'inPoint' | 'outPoint' | 'region' | null
