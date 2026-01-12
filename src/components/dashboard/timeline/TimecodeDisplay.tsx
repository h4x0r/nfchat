import { formatTimecode } from './utils'
import { PREMIERE_COLORS, TIMELINE_CONFIG } from './constants'
import type { TimecodeDisplayProps } from './types'

/**
 * Premiere Pro-style timecode display showing current position, duration,
 * and optional in/out points for A-B region selection.
 */
export function TimecodeDisplay({
  currentTime,
  duration,
  inPoint,
  outPoint,
  fps = TIMELINE_CONFIG.defaultFps,
}: TimecodeDisplayProps) {
  const hasRegion = inPoint !== null && inPoint !== undefined &&
                    outPoint !== null && outPoint !== undefined
  const regionDuration = hasRegion ? outPoint - inPoint : 0

  return (
    <div
      className="bg-[#1a1a1a] border border-[#2a2a2a] rounded px-3 py-1.5 font-mono text-xs flex items-center gap-4"
      style={{ color: PREMIERE_COLORS.text }}
    >
      {/* Current Time / Duration */}
      <div className="flex items-center gap-1.5">
        <span style={{ color: PREMIERE_COLORS.textBright }}>
          {formatTimecode(currentTime, fps)}
        </span>
        <span style={{ color: PREMIERE_COLORS.textDim }}>/</span>
        <span>{formatTimecode(duration, fps)}</span>
      </div>

      {/* In/Out Points (when set) */}
      {hasRegion && (
        <>
          <div className="w-px h-4 bg-[#333]" />
          <div className="flex items-center gap-1.5">
            <span style={{ color: PREMIERE_COLORS.inPoint }}>
              {formatTimecode(inPoint, fps)}
            </span>
            <span style={{ color: PREMIERE_COLORS.textDim }}>→</span>
            <span style={{ color: PREMIERE_COLORS.outPoint }}>
              {formatTimecode(outPoint, fps)}
            </span>
            <span style={{ color: PREMIERE_COLORS.textDim }}>=</span>
            <span style={{ color: PREMIERE_COLORS.textBright }}>
              {formatTimecode(regionDuration, fps)}
            </span>
          </div>
        </>
      )}
    </div>
  )
}
