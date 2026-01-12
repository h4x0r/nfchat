import { useMemo } from 'react'
import { PREMIERE_COLORS, TIMELINE_CONFIG } from './constants'
import { generateTickMarks, timeToPixel } from './utils'
import type { TimeRulerProps } from './types'

/**
 * Format time in seconds to a readable label (M:SS or H:MM:SS)
 */
function formatTimeLabel(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

/**
 * Premiere Pro-style time ruler with adaptive tick marks.
 * Shows major and minor ticks based on zoom level.
 */
export function TimeRuler({ startTime, endTime, width }: TimeRulerProps) {
  const ticks = useMemo(
    () => generateTickMarks(startTime, endTime, width),
    [startTime, endTime, width]
  )

  return (
    <div
      className="bg-[#1a1a1a] border-b border-[#2a2a2a] relative select-none"
      style={{ height: TIMELINE_CONFIG.rulerHeight, width }}
    >
      {/* Tick marks */}
      {ticks.map((tick, i) => {
        const x = timeToPixel(tick.time, width, startTime, endTime)
        const isMajor = tick.major

        return (
          <div
            key={i}
            data-tick={isMajor ? 'major' : 'minor'}
            className="absolute bottom-0"
            style={{
              left: x,
              height: isMajor ? 12 : 6,
              width: 1,
              backgroundColor: isMajor
                ? PREMIERE_COLORS.gridLineMajor
                : PREMIERE_COLORS.gridLine,
            }}
          />
        )
      })}

      {/* Time labels (only on major ticks) */}
      {ticks
        .filter((tick) => tick.major)
        .map((tick, i) => {
          const x = timeToPixel(tick.time, width, startTime, endTime)

          return (
            <div
              key={`label-${i}`}
              className="absolute text-[10px] font-mono whitespace-nowrap"
              style={{
                left: x,
                top: 2,
                transform: 'translateX(-50%)',
                color: PREMIERE_COLORS.textDim,
              }}
            >
              {formatTimeLabel(tick.time)}
            </div>
          )
        })}
    </div>
  )
}
