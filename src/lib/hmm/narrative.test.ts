import { describe, it, expect } from 'vitest'
import { generateNarrative } from './narrative'
import type { StateProfile } from '@/lib/store/types'

describe('generateNarrative', () => {
  it('should generate narrative for scanning behavior', () => {
    const scanState: StateProfile = {
      stateId: 1,
      flowCount: 1000,
      avgInBytes: 200,
      avgOutBytes: 100,
      bytesRatio: 0.5,
      avgDurationMs: 50,
      avgPktsPerSec: 2.5,
      protocolDist: { tcp: 0.9, udp: 0.1, icmp: 0 },
      portCategoryDist: { wellKnown: 0.8, registered: 0.15, ephemeral: 0.05 },
    }

    const narrative = generateNarrative(scanState)
    expect(narrative).toContain('short-duration')
    expect(narrative).toContain('low-volume')
    expect(narrative).toContain('well-known ports')
    expect(narrative).toContain('TCP')
  })

  it('should generate narrative for exfiltration behavior', () => {
    const exfilState: StateProfile = {
      stateId: 2,
      flowCount: 50,
      avgInBytes: 5000,
      avgOutBytes: 500000,
      bytesRatio: 100,
      avgDurationMs: 30000,
      avgPktsPerSec: 50,
      protocolDist: { tcp: 0.95, udp: 0.05, icmp: 0 },
      portCategoryDist: { wellKnown: 0.1, registered: 0.2, ephemeral: 0.7 },
    }

    const narrative = generateNarrative(exfilState)
    expect(narrative).toContain('high-volume')
    expect(narrative).toContain('outbound')
    expect(narrative).toContain('ephemeral ports')
    expect(narrative).toContain('TCP')
  })

  it('should generate narrative for DNS-heavy behavior', () => {
    const dnsState: StateProfile = {
      stateId: 3,
      flowCount: 2000,
      avgInBytes: 150,
      avgOutBytes: 150,
      bytesRatio: 1.0,
      avgDurationMs: 20,
      avgPktsPerSec: 5,
      protocolDist: { tcp: 0.05, udp: 0.95, icmp: 0 },
      portCategoryDist: { wellKnown: 0.9, registered: 0.05, ephemeral: 0.05 },
    }

    const narrative = generateNarrative(dnsState)
    expect(narrative).toContain('UDP')
    expect(narrative).toContain('short-duration')
    expect(narrative).toContain('low-volume')
  })

  it('should generate narrative for normal web browsing', () => {
    const webState: StateProfile = {
      stateId: 4,
      flowCount: 800,
      avgInBytes: 50000,
      avgOutBytes: 2000,
      bytesRatio: 0.04,
      avgDurationMs: 5000,
      avgPktsPerSec: 20,
      protocolDist: { tcp: 0.98, udp: 0.02, icmp: 0 },
      portCategoryDist: { wellKnown: 0.7, registered: 0.2, ephemeral: 0.1 },
    }

    const narrative = generateNarrative(webState)
    expect(narrative).toContain('high-volume')
    expect(narrative).toContain('inbound')
    expect(narrative).toContain('TCP')
  })

  it('should generate narrative for ICMP-heavy behavior', () => {
    const icmpState: StateProfile = {
      stateId: 5,
      flowCount: 500,
      avgInBytes: 64,
      avgOutBytes: 64,
      bytesRatio: 1.0,
      avgDurationMs: 10,
      avgPktsPerSec: 1,
      protocolDist: { tcp: 0, udp: 0.05, icmp: 0.95 },
      portCategoryDist: { wellKnown: 0, registered: 0, ephemeral: 0 },
    }

    const narrative = generateNarrative(icmpState)
    expect(narrative).toContain('ICMP')
    expect(narrative).toContain('short-duration')
  })

  it('should generate narrative for long-duration connections', () => {
    const longState: StateProfile = {
      stateId: 6,
      flowCount: 100,
      avgInBytes: 100000,
      avgOutBytes: 100000,
      bytesRatio: 1.0,
      avgDurationMs: 120000,
      avgPktsPerSec: 10,
      protocolDist: { tcp: 1.0, udp: 0, icmp: 0 },
      portCategoryDist: { wellKnown: 0.5, registered: 0.3, ephemeral: 0.2 },
    }

    const narrative = generateNarrative(longState)
    expect(narrative).toContain('long-duration')
    expect(narrative).toContain('bidirectional')
    expect(narrative).toContain('TCP')
  })

  it('should generate narrative for balanced protocol mix', () => {
    const mixedState: StateProfile = {
      stateId: 7,
      flowCount: 1500,
      avgInBytes: 10000,
      avgOutBytes: 10000,
      bytesRatio: 1.0,
      avgDurationMs: 1000,
      avgPktsPerSec: 15,
      protocolDist: { tcp: 0.5, udp: 0.45, icmp: 0.05 },
      portCategoryDist: { wellKnown: 0.4, registered: 0.3, ephemeral: 0.3 },
    }

    const narrative = generateNarrative(mixedState)
    expect(narrative).toContain('mixed protocol')
    expect(narrative).toContain('medium-volume')
  })

  it('should handle edge case with zero values', () => {
    const zeroState: StateProfile = {
      stateId: 8,
      flowCount: 1,
      avgInBytes: 0,
      avgOutBytes: 0,
      bytesRatio: 0,
      avgDurationMs: 0,
      avgPktsPerSec: 0,
      protocolDist: { tcp: 0, udp: 0, icmp: 0 },
      portCategoryDist: { wellKnown: 0, registered: 0, ephemeral: 0 },
    }

    const narrative = generateNarrative(zeroState)
    expect(narrative).toBeTruthy()
    expect(narrative.length).toBeGreaterThan(10)
  })

  describe('volume boundary conditions', () => {
    it('volume boundary: 999 bytes → low-volume, 1000 bytes → medium-volume', () => {
      const lowVolumeState: StateProfile = {
        stateId: 9,
        flowCount: 100,
        avgInBytes: 500,
        avgOutBytes: 499, // total = 999
        bytesRatio: 1.0,
        avgDurationMs: 1000,
        avgPktsPerSec: 10,
        protocolDist: { tcp: 1.0, udp: 0, icmp: 0 },
        portCategoryDist: { wellKnown: 0.5, registered: 0.3, ephemeral: 0.2 },
      }

      const mediumVolumeState: StateProfile = {
        ...lowVolumeState,
        stateId: 10,
        avgInBytes: 500,
        avgOutBytes: 500, // total = 1000
      }

      const lowNarrative = generateNarrative(lowVolumeState)
      const mediumNarrative = generateNarrative(mediumVolumeState)

      expect(lowNarrative).toContain('low-volume')
      expect(mediumNarrative).toContain('medium-volume')
    })

    it('volume boundary: 49999 → medium-volume, 50000 → high-volume', () => {
      const mediumVolumeState: StateProfile = {
        stateId: 11,
        flowCount: 100,
        avgInBytes: 25000,
        avgOutBytes: 24999, // total = 49999
        bytesRatio: 1.0,
        avgDurationMs: 1000,
        avgPktsPerSec: 10,
        protocolDist: { tcp: 1.0, udp: 0, icmp: 0 },
        portCategoryDist: { wellKnown: 0.5, registered: 0.3, ephemeral: 0.2 },
      }

      const highVolumeState: StateProfile = {
        ...mediumVolumeState,
        stateId: 12,
        avgInBytes: 25000,
        avgOutBytes: 25000, // total = 50000
      }

      const mediumNarrative = generateNarrative(mediumVolumeState)
      const highNarrative = generateNarrative(highVolumeState)

      expect(mediumNarrative).toContain('medium-volume')
      expect(highNarrative).toContain('high-volume')
    })
  })

  describe('duration boundary conditions', () => {
    it('duration boundary: 99ms → short, 100ms → medium', () => {
      const shortState: StateProfile = {
        stateId: 13,
        flowCount: 100,
        avgInBytes: 1000,
        avgOutBytes: 1000,
        bytesRatio: 1.0,
        avgDurationMs: 99,
        avgPktsPerSec: 10,
        protocolDist: { tcp: 1.0, udp: 0, icmp: 0 },
        portCategoryDist: { wellKnown: 0.5, registered: 0.3, ephemeral: 0.2 },
      }

      const mediumState: StateProfile = {
        ...shortState,
        stateId: 14,
        avgDurationMs: 100,
      }

      const shortNarrative = generateNarrative(shortState)
      const mediumNarrative = generateNarrative(mediumState)

      expect(shortNarrative).toContain('short-duration')
      expect(mediumNarrative).toContain('medium-duration')
    })

    it('duration boundary: 9999ms → medium, 10000ms → long', () => {
      const mediumState: StateProfile = {
        stateId: 15,
        flowCount: 100,
        avgInBytes: 1000,
        avgOutBytes: 1000,
        bytesRatio: 1.0,
        avgDurationMs: 9999,
        avgPktsPerSec: 10,
        protocolDist: { tcp: 1.0, udp: 0, icmp: 0 },
        portCategoryDist: { wellKnown: 0.5, registered: 0.3, ephemeral: 0.2 },
      }

      const longState: StateProfile = {
        ...mediumState,
        stateId: 16,
        avgDurationMs: 10000,
      }

      const mediumNarrative = generateNarrative(mediumState)
      const longNarrative = generateNarrative(longState)

      expect(mediumNarrative).toContain('medium-duration')
      expect(longNarrative).toContain('long-duration')
    })
  })

  describe('direction boundary conditions', () => {
    it('direction: exactly 50/50 split (0.5 each) → bidirectional', () => {
      const bidirectionalState: StateProfile = {
        stateId: 17,
        flowCount: 100,
        avgInBytes: 5000,
        avgOutBytes: 5000, // 50/50 split
        bytesRatio: 1.0,
        avgDurationMs: 1000,
        avgPktsPerSec: 10,
        protocolDist: { tcp: 1.0, udp: 0, icmp: 0 },
        portCategoryDist: { wellKnown: 0.5, registered: 0.3, ephemeral: 0.2 },
      }

      const narrative = generateNarrative(bidirectionalState)
      expect(narrative).toContain('bidirectional')
    })

    it('direction: 70/30 inbound → not inbound-heavy (needs >0.7)', () => {
      const state: StateProfile = {
        stateId: 18,
        flowCount: 100,
        avgInBytes: 7000,
        avgOutBytes: 3000, // 70/30 split (0.7 inbound)
        bytesRatio: 0.43,
        avgDurationMs: 1000,
        avgPktsPerSec: 10,
        protocolDist: { tcp: 1.0, udp: 0, icmp: 0 },
        portCategoryDist: { wellKnown: 0.5, registered: 0.3, ephemeral: 0.2 },
      }

      const narrative = generateNarrative(state)
      // Should not be labeled as inbound-heavy (requires >0.7)
      // Could be empty string or bidirectional depending on implementation
      expect(narrative).not.toContain('inbound-heavy')
    })

    it('direction: 71/29 inbound → inbound-heavy', () => {
      const state: StateProfile = {
        stateId: 19,
        flowCount: 100,
        avgInBytes: 7100,
        avgOutBytes: 2900, // 71/29 split (0.71 inbound)
        bytesRatio: 0.41,
        avgDurationMs: 1000,
        avgPktsPerSec: 10,
        protocolDist: { tcp: 1.0, udp: 0, icmp: 0 },
        portCategoryDist: { wellKnown: 0.5, registered: 0.3, ephemeral: 0.2 },
      }

      const narrative = generateNarrative(state)
      expect(narrative).toContain('inbound-heavy')
    })
  })

  describe('protocol boundary conditions', () => {
    it('protocol: exactly TCP=0.8 → not dominant (>0.8 required)', () => {
      const state: StateProfile = {
        stateId: 20,
        flowCount: 100,
        avgInBytes: 1000,
        avgOutBytes: 1000,
        bytesRatio: 1.0,
        avgDurationMs: 1000,
        avgPktsPerSec: 10,
        protocolDist: { tcp: 0.8, udp: 0.15, icmp: 0.05 }, // exactly 0.8
        portCategoryDist: { wellKnown: 0.5, registered: 0.3, ephemeral: 0.2 },
      }

      const narrative = generateNarrative(state)
      // With tcp=0.8 (not > 0.8), falls through to "predominantly TCP flows" logic
      expect(narrative).toContain('predominantly TCP')
      // Note: actual output may include both "predominantly" and "TCP flows" together
    })

    it('protocol: TCP=0.81 → TCP flows', () => {
      const state: StateProfile = {
        stateId: 21,
        flowCount: 100,
        avgInBytes: 1000,
        avgOutBytes: 1000,
        bytesRatio: 1.0,
        avgDurationMs: 1000,
        avgPktsPerSec: 10,
        protocolDist: { tcp: 0.81, udp: 0.14, icmp: 0.05 }, // just over 0.8
        portCategoryDist: { wellKnown: 0.5, registered: 0.3, ephemeral: 0.2 },
      }

      const narrative = generateNarrative(state)
      expect(narrative).toContain('TCP flows')
    })

    it('protocol: UDP dominant with ICMP significant → mixed protocol (UDP/ICMP)', () => {
      const state: StateProfile = {
        stateId: 22,
        flowCount: 100,
        avgInBytes: 1000,
        avgOutBytes: 1000,
        bytesRatio: 1.0,
        avgDurationMs: 1000,
        avgPktsPerSec: 10,
        protocolDist: { tcp: 0.05, udp: 0.7, icmp: 0.25 }, // UDP dominant, ICMP significant
        portCategoryDist: { wellKnown: 0.5, registered: 0.3, ephemeral: 0.2 },
      }

      const narrative = generateNarrative(state)
      expect(narrative).toContain('mixed protocol (UDP/ICMP)')
    })
  })

  describe('port boundary conditions', () => {
    it('ports: registered=0.61 → registered ports', () => {
      const state: StateProfile = {
        stateId: 23,
        flowCount: 100,
        avgInBytes: 1000,
        avgOutBytes: 1000,
        bytesRatio: 1.0,
        avgDurationMs: 1000,
        avgPktsPerSec: 10,
        protocolDist: { tcp: 1.0, udp: 0, icmp: 0 },
        portCategoryDist: { wellKnown: 0.2, registered: 0.61, ephemeral: 0.19 },
      }

      const narrative = generateNarrative(state)
      expect(narrative).toContain('registered ports')
    })

    it('ports: all below 0.6 → mixed port ranges', () => {
      const state: StateProfile = {
        stateId: 24,
        flowCount: 100,
        avgInBytes: 1000,
        avgOutBytes: 1000,
        bytesRatio: 1.0,
        avgDurationMs: 1000,
        avgPktsPerSec: 10,
        protocolDist: { tcp: 1.0, udp: 0, icmp: 0 },
        portCategoryDist: { wellKnown: 0.4, registered: 0.3, ephemeral: 0.3 },
      }

      const narrative = generateNarrative(state)
      expect(narrative).toContain('mixed port ranges')
    })
  })
})
