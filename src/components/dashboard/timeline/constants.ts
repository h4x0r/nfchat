/**
 * Premiere Pro-inspired color palette for the timeline component.
 * Dark theme optimized for professional video editing aesthetics.
 */
export const PREMIERE_COLORS = {
  // Backgrounds
  bg: '#0a0a0a',
  panelBg: '#1a1a1a',
  trackBg: '#141414',

  // Borders & Grid
  border: '#2a2a2a',
  gridLine: '#252525',
  gridLineMajor: '#333333',

  // Text
  text: '#808080',
  textDim: '#555555',
  textBright: '#ffffff',

  // Playhead
  playhead: '#00aaff',
  playheadGlow: 'rgba(0, 170, 255, 0.4)',

  // In/Out Points (A-B selection)
  inPoint: '#f5c518',
  outPoint: '#ff6b00',

  // Region Selection
  regionFill: 'rgba(0, 170, 255, 0.12)',
  regionBorder: 'rgba(0, 170, 255, 0.4)',

  // Waveform / Data visualization
  waveform: '#4a4a4a',
  waveformPeak: '#666666',

  // Controls
  controlBg: '#333333',
  controlBgHover: '#444444',
  controlBgActive: '#0066cc',

  // Severity colors (for attack markers)
  severity: {
    normal: '#00d084',
    elevated: '#ffc107',
    high: '#ff9800',
    severe: '#f44336',
  },
} as const

/**
 * Playback speed options (matches vibview)
 */
export const SPEED_OPTIONS = [0.25, 0.5, 1, 1.5, 2, 4] as const
export type PlaybackSpeed = (typeof SPEED_OPTIONS)[number]

/**
 * Default timeline configuration
 */
export const TIMELINE_CONFIG = {
  defaultFps: 30,
  rulerHeight: 24,
  trackHeight: 80,
  overviewHeight: 40,
  controlsHeight: 48,
  minRegionDuration: 500, // ms - minimum A-B selection
} as const
