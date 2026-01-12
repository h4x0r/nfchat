import { PREMIERE_COLORS } from './constants'
import { clamp } from './utils'
import type { PlayheadProps } from './types'

/**
 * Premiere Pro-style playhead with draggable handle and glow effect.
 * Position is specified as a percentage (0-100).
 */
export function Playhead({
  position,
  visible = true,
  onDragStart,
  onDrag,
  onDragEnd,
}: PlayheadProps) {
  const clampedPosition = clamp(position, 0, 100)

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onDragStart?.()

    const handleMouseMove = (moveEvent: MouseEvent) => {
      // Parent should handle converting to position
      onDrag?.(moveEvent.clientX)
    }

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      onDragEnd?.()
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  return (
    <div
      data-playhead
      className={`absolute top-0 bottom-0 pointer-events-none transition-opacity ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
      style={{
        left: `${clampedPosition}%`,
        width: 2,
        backgroundColor: PREMIERE_COLORS.playhead,
        boxShadow: `0 0 8px ${PREMIERE_COLORS.playheadGlow}`,
        transform: 'translateX(-50%)',
        zIndex: 20,
      }}
    >
      {/* Triangular handle at top */}
      <div
        data-playhead-handle
        className="absolute cursor-grab active:cursor-grabbing pointer-events-auto"
        style={{
          top: -8,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 0,
          height: 0,
          borderLeft: '6px solid transparent',
          borderRight: '6px solid transparent',
          borderTop: `8px solid ${PREMIERE_COLORS.playhead}`,
        }}
        onMouseDown={handleMouseDown}
      />
    </div>
  )
}
