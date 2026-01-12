import { useState } from 'react'
import { Play, Pause, RotateCcw, ChevronDown } from 'lucide-react'
import { PREMIERE_COLORS, SPEED_OPTIONS } from './constants'
import type { PlaybackControlsProps } from './types'

/**
 * Premiere Pro-style playback controls with play/pause, rewind, and speed selector.
 */
export function PlaybackControls({
  isPlaying,
  speed,
  disabled = false,
  onPlayPause,
  onRewind,
  onSpeedChange,
}: PlaybackControlsProps) {
  const [showSpeedMenu, setShowSpeedMenu] = useState(false)

  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded flex items-center gap-1 px-2 py-1">
      {/* Rewind button */}
      <button
        aria-label="Rewind"
        className="p-1.5 rounded hover:bg-[#333] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        style={{ color: PREMIERE_COLORS.text }}
        onClick={onRewind}
        disabled={disabled}
      >
        <RotateCcw size={16} />
      </button>

      {/* Play/Pause button */}
      <button
        aria-label={isPlaying ? 'Pause' : 'Play'}
        className="p-1.5 rounded hover:bg-[#333] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        style={{ color: PREMIERE_COLORS.textBright }}
        onClick={onPlayPause}
        disabled={disabled}
      >
        {isPlaying ? <Pause size={18} /> : <Play size={18} />}
      </button>

      {/* Speed selector */}
      <div className="relative ml-2">
        <button
          className="flex items-center gap-0.5 px-2 py-1 rounded hover:bg-[#333] text-xs font-mono disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          style={{ color: PREMIERE_COLORS.text }}
          onClick={() => setShowSpeedMenu(!showSpeedMenu)}
          disabled={disabled}
        >
          {speed}x
          <ChevronDown size={12} />
        </button>

        {showSpeedMenu && !disabled && (
          <div
            className="absolute bottom-full left-0 mb-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded shadow-lg py-1 min-w-[60px] z-30"
            onMouseLeave={() => setShowSpeedMenu(false)}
          >
            {SPEED_OPTIONS.map((option) => (
              <button
                key={option}
                className="w-full px-3 py-1 text-left text-xs font-mono hover:bg-[#333] transition-colors"
                style={{
                  color:
                    option === speed
                      ? PREMIERE_COLORS.playhead
                      : PREMIERE_COLORS.text,
                }}
                onClick={() => {
                  onSpeedChange(option)
                  setShowSpeedMenu(false)
                }}
              >
                {option}x
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
