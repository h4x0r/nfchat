import { TIMELINE_CONFIG } from './constants'

/**
 * Format milliseconds as timecode MM:SS:FF (minutes:seconds:frames)
 */
export function formatTimecode(ms: number, fps: number = TIMELINE_CONFIG.defaultFps): string {
  if (!isFinite(ms) || ms < 0) return '00:00:00'

  const totalSeconds = ms / 1000
  const mins = Math.floor(totalSeconds / 60)
  const secs = Math.floor(totalSeconds % 60)
  const frames = Math.floor((totalSeconds % 1) * fps)

  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`
}

/**
 * Format milliseconds as short time (e.g., "5.0s" or "1:05.0")
 */
export function formatTimeShort(ms: number): string {
  if (!isFinite(ms) || ms < 0) return '0.0s'

  const totalSeconds = ms / 1000
  const mins = Math.floor(totalSeconds / 60)
  const secs = (totalSeconds % 60).toFixed(1)

  if (mins > 0) {
    return `${mins}:${secs.padStart(4, '0')}`
  }
  return `${secs}s`
}

/**
 * Convert milliseconds to seconds
 */
export function msToSeconds(ms: number): number {
  return ms / 1000
}

/**
 * Clamp a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/**
 * Convert pixel position to time value
 * @param pixelX - X position in pixels
 * @param trackWidth - Total track width in pixels
 * @param startTime - Start time of the visible range (ms)
 * @param endTime - End time of the visible range (ms)
 */
export function pixelToTime(
  pixelX: number,
  trackWidth: number,
  startTime: number,
  endTime: number
): number {
  if (trackWidth <= 0) return startTime
  const percentage = clamp(pixelX / trackWidth, 0, 1)
  return startTime + percentage * (endTime - startTime)
}

/**
 * Convert time value to pixel position
 * @param time - Time value in ms
 * @param trackWidth - Total track width in pixels
 * @param startTime - Start time of the visible range (ms)
 * @param endTime - End time of the visible range (ms)
 */
export function timeToPixel(
  time: number,
  trackWidth: number,
  startTime: number,
  endTime: number
): number {
  const duration = endTime - startTime
  if (duration <= 0) return 0
  return ((time - startTime) / duration) * trackWidth
}

/**
 * Convert time to percentage (0-100)
 */
export function timeToPercent(
  time: number,
  startTime: number,
  endTime: number
): number {
  const duration = endTime - startTime
  if (duration <= 0) return 0
  return clamp(((time - startTime) / duration) * 100, 0, 100)
}

/**
 * Convert percentage to time
 */
export function percentToTime(
  percent: number,
  startTime: number,
  endTime: number
): number {
  return startTime + (percent / 100) * (endTime - startTime)
}

/**
 * Get adaptive tick interval based on zoom level (pixels per second)
 */
export function getAdaptiveTickInterval(pixelsPerSecond: number): {
  majorInterval: number
  minorDivisions: number
} {
  if (pixelsPerSecond > 100) {
    return { majorInterval: 1, minorDivisions: 10 }
  } else if (pixelsPerSecond > 50) {
    return { majorInterval: 2, minorDivisions: 4 }
  } else if (pixelsPerSecond > 20) {
    return { majorInterval: 5, minorDivisions: 5 }
  } else if (pixelsPerSecond > 5) {
    return { majorInterval: 10, minorDivisions: 10 }
  } else {
    return { majorInterval: 30, minorDivisions: 6 }
  }
}

/**
 * Generate tick marks for the time ruler
 */
export function generateTickMarks(
  startTime: number,
  endTime: number,
  width: number
): { time: number; major: boolean }[] {
  const duration = (endTime - startTime) / 1000 // in seconds
  if (duration <= 0 || width <= 0) return []

  const pixelsPerSecond = width / duration
  const { majorInterval, minorDivisions } = getAdaptiveTickInterval(pixelsPerSecond)
  const minorInterval = majorInterval / minorDivisions

  const ticks: { time: number; major: boolean }[] = []
  const firstTick = Math.ceil((startTime / 1000) / minorInterval) * minorInterval

  for (let t = firstTick; t <= endTime / 1000; t += minorInterval) {
    const isMajor =
      Math.abs(t % majorInterval) < 0.001 ||
      Math.abs((t % majorInterval) - majorInterval) < 0.001
    ticks.push({ time: t * 1000, major: isMajor })
  }

  return ticks
}
