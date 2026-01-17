import { describe, it, expect } from 'vitest'
import { detectColumnMapping, REQUIRED_COLUMNS } from './column-mapper'

describe('column-mapper', () => {
  describe('detectColumnMapping', () => {
    it('detects standard NetFlow column names', () => {
      const headers = ['IPV4_SRC_ADDR', 'IPV4_DST_ADDR', 'L4_SRC_PORT', 'L4_DST_PORT', 'PROTOCOL']
      const result = detectColumnMapping(headers)

      expect(result.success).toBe(true)
      expect(result.mapping?.IPV4_SRC_ADDR).toBe('IPV4_SRC_ADDR')
      expect(result.mapping?.IPV4_DST_ADDR).toBe('IPV4_DST_ADDR')
    })

    it('detects nfdump column names (sa, da, sp, dp, pr)', () => {
      const headers = ['sa', 'da', 'sp', 'dp', 'pr', 'ibyt', 'obyt']
      const result = detectColumnMapping(headers)

      expect(result.success).toBe(true)
      expect(result.mapping?.IPV4_SRC_ADDR).toBe('sa')
      expect(result.mapping?.IPV4_DST_ADDR).toBe('da')
      expect(result.mapping?.L4_SRC_PORT).toBe('sp')
      expect(result.mapping?.L4_DST_PORT).toBe('dp')
      expect(result.mapping?.PROTOCOL).toBe('pr')
    })

    it('detects SiLK column names (sIP, dIP)', () => {
      const headers = ['sIP', 'dIP', 'sPort', 'dPort', 'protocol']
      const result = detectColumnMapping(headers)

      expect(result.success).toBe(true)
      expect(result.mapping?.IPV4_SRC_ADDR).toBe('sIP')
      expect(result.mapping?.IPV4_DST_ADDR).toBe('dIP')
    })

    it('detects generic names (src_ip, dst_ip)', () => {
      const headers = ['src_ip', 'dst_ip', 'src_port', 'dst_port', 'proto']
      const result = detectColumnMapping(headers)

      expect(result.success).toBe(true)
      expect(result.mapping?.IPV4_SRC_ADDR).toBe('src_ip')
      expect(result.mapping?.IPV4_DST_ADDR).toBe('dst_ip')
    })

    it('is case-insensitive', () => {
      const headers = ['SRC_IP', 'DST_IP', 'SRC_PORT', 'DST_PORT', 'PROTO']
      const result = detectColumnMapping(headers)

      expect(result.success).toBe(true)
      expect(result.mapping?.IPV4_SRC_ADDR).toBe('SRC_IP')
    })

    it('returns failure with missing columns when required columns not found', () => {
      const headers = ['timestamp', 'bytes', 'packets']
      const result = detectColumnMapping(headers)

      expect(result.success).toBe(false)
      expect(result.missingColumns).toBeDefined()
      expect(result.missingColumns?.length).toBeGreaterThan(0)
    })

    it('detects Attack column variations', () => {
      const headers = ['src_ip', 'dst_ip', 'attack_type', 'label']
      const result = detectColumnMapping(headers)

      expect(result.mapping?.Attack).toBe('attack_type')
    })

    it('returns found headers for manual mapping fallback', () => {
      const headers = ['col1', 'col2', 'col3']
      const result = detectColumnMapping(headers)

      expect(result.foundHeaders).toEqual(headers)
    })
  })

  describe('REQUIRED_COLUMNS', () => {
    it('includes core NetFlow columns', () => {
      expect(REQUIRED_COLUMNS).toContain('IPV4_SRC_ADDR')
      expect(REQUIRED_COLUMNS).toContain('IPV4_DST_ADDR')
    })
  })
})
