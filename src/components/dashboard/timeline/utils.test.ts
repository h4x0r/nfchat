import { describe, expect, it } from 'vitest'
import {
  formatTimecode,
  formatTimeShort,
  msToSeconds,
  pixelToTime,
  timeToPixel,
  clamp,
  getAdaptiveTickInterval,
} from './utils'

describe('formatTimecode', () => {
  it('formats 0ms as 00:00:00', () => {
    expect(formatTimecode(0)).toBe('00:00:00')
  })

  it('formats 1000ms as 00:01:00 at 30fps', () => {
    expect(formatTimecode(1000)).toBe('00:01:00')
  })

  it('formats 61500ms as 01:01:15 at 30fps', () => {
    // 61.5 seconds = 1 min, 1 sec, 15 frames (0.5 * 30 = 15)
    expect(formatTimecode(61500)).toBe('01:01:15')
  })

  it('formats 3723000ms as 62:03:00', () => {
    // 62 minutes, 3 seconds = 3723 seconds
    expect(formatTimecode(3723000)).toBe('62:03:00')
  })

  it('handles negative values as 00:00:00', () => {
    expect(formatTimecode(-1000)).toBe('00:00:00')
  })

  it('handles non-finite values as 00:00:00', () => {
    expect(formatTimecode(NaN)).toBe('00:00:00')
    expect(formatTimecode(Infinity)).toBe('00:00:00')
  })

  it('uses custom fps for frame calculation', () => {
    // 0.5 seconds at 24fps = 12 frames
    expect(formatTimecode(500, 24)).toBe('00:00:12')
  })
})

describe('formatTimeShort', () => {
  it('formats seconds-only as Xs', () => {
    expect(formatTimeShort(5000)).toBe('5.0s')
  })

  it('formats with minutes as M:SS.s', () => {
    expect(formatTimeShort(65000)).toBe('1:05.0')
  })

  it('formats zero as 0.0s', () => {
    expect(formatTimeShort(0)).toBe('0.0s')
  })

  it('handles sub-second precision', () => {
    expect(formatTimeShort(1500)).toBe('1.5s')
  })
})

describe('msToSeconds', () => {
  it('converts milliseconds to seconds', () => {
    expect(msToSeconds(1000)).toBe(1)
    expect(msToSeconds(2500)).toBe(2.5)
    expect(msToSeconds(0)).toBe(0)
  })
})

describe('pixelToTime', () => {
  it('converts pixel position to time', () => {
    // 50% of 100px track with 0-1000ms range = 500ms
    expect(pixelToTime(50, 100, 0, 1000)).toBe(500)
  })

  it('handles offset start time', () => {
    // 50% of 100px track with 1000-2000ms range = 1500ms
    expect(pixelToTime(50, 100, 1000, 2000)).toBe(1500)
  })

  it('clamps to range', () => {
    expect(pixelToTime(-10, 100, 0, 1000)).toBe(0)
    expect(pixelToTime(150, 100, 0, 1000)).toBe(1000)
  })
})

describe('timeToPixel', () => {
  it('converts time to pixel position', () => {
    // 500ms in 0-1000ms range on 100px track = 50px
    expect(timeToPixel(500, 100, 0, 1000)).toBe(50)
  })

  it('handles offset start time', () => {
    // 1500ms in 1000-2000ms range on 100px track = 50px
    expect(timeToPixel(1500, 100, 1000, 2000)).toBe(50)
  })

  it('returns 0 for zero duration', () => {
    expect(timeToPixel(500, 100, 0, 0)).toBe(0)
  })
})

describe('clamp', () => {
  it('returns value when in range', () => {
    expect(clamp(5, 0, 10)).toBe(5)
  })

  it('returns min when value is below', () => {
    expect(clamp(-5, 0, 10)).toBe(0)
  })

  it('returns max when value is above', () => {
    expect(clamp(15, 0, 10)).toBe(10)
  })
})

describe('getAdaptiveTickInterval', () => {
  it('returns 1s interval for high zoom (>100 px/s)', () => {
    const result = getAdaptiveTickInterval(150) // 150 px/s
    expect(result.majorInterval).toBe(1)
  })

  it('returns 10s interval for low zoom (5-20 px/s)', () => {
    const result = getAdaptiveTickInterval(10) // 10 px/s
    expect(result.majorInterval).toBe(10)
  })

  it('returns 30s interval for very low zoom (<5 px/s)', () => {
    const result = getAdaptiveTickInterval(3) // 3 px/s
    expect(result.majorInterval).toBe(30)
  })

  it('includes minor divisions', () => {
    const result = getAdaptiveTickInterval(100)
    expect(result.minorDivisions).toBeGreaterThan(0)
  })
})
