/**
 * CSV Column Auto-Detection for NetFlow Data
 *
 * Maps various NetFlow export formats to standard column names.
 * Supports: nfdump, SiLK, generic exports
 */

// Standard column names used internally
export const REQUIRED_COLUMNS = [
  'IPV4_SRC_ADDR',
  'IPV4_DST_ADDR',
] as const

export const OPTIONAL_COLUMNS = [
  'L4_SRC_PORT',
  'L4_DST_PORT',
  'PROTOCOL',
  'IN_BYTES',
  'OUT_BYTES',
  'IN_PKTS',
  'OUT_PKTS',
  'Attack',
  'Label',
] as const

export type StandardColumn = typeof REQUIRED_COLUMNS[number] | typeof OPTIONAL_COLUMNS[number]

// Mapping from standard column to possible CSV header names (lowercase for matching)
const COLUMN_ALIASES: Record<StandardColumn, string[]> = {
  // Source IP
  IPV4_SRC_ADDR: ['ipv4_src_addr', 'sa', 'sip', 'src_ip', 'source_ip', 'srcaddr', 'srcip', 'source'],

  // Destination IP
  IPV4_DST_ADDR: ['ipv4_dst_addr', 'da', 'dip', 'dst_ip', 'dest_ip', 'dstaddr', 'dstip', 'destination'],

  // Source Port
  L4_SRC_PORT: ['l4_src_port', 'sp', 'sport', 'src_port', 'source_port', 'srcport'],

  // Destination Port
  L4_DST_PORT: ['l4_dst_port', 'dp', 'dport', 'dst_port', 'dest_port', 'dstport'],

  // Protocol
  PROTOCOL: ['protocol', 'pr', 'proto', 'ip_protocol'],

  // Bytes
  IN_BYTES: ['in_bytes', 'ibyt', 'bytes_in', 'inbytes', 'bytsin', 'rxbytes'],
  OUT_BYTES: ['out_bytes', 'obyt', 'bytes_out', 'outbytes', 'bytsout', 'txbytes'],

  // Packets
  IN_PKTS: ['in_pkts', 'ipkt', 'pkts_in', 'inpkts', 'rxpackets'],
  OUT_PKTS: ['out_pkts', 'opkt', 'pkts_out', 'outpkts', 'txpackets'],

  // Attack labels
  Attack: ['attack', 'attack_type', 'attacktype', 'category', 'threat'],
  Label: ['label', 'is_attack', 'malicious'],
}

export type ColumnMapping = Partial<Record<StandardColumn, string>>

export interface DetectionResult {
  success: boolean
  mapping?: ColumnMapping
  missingColumns?: StandardColumn[]
  foundHeaders: string[]
}

/**
 * Detect column mapping from CSV headers
 */
export function detectColumnMapping(headers: string[]): DetectionResult {
  const mapping: ColumnMapping = {}
  const headerLower = headers.map((h) => h.toLowerCase())

  // Try to match each standard column
  for (const [standardCol, aliases] of Object.entries(COLUMN_ALIASES)) {
    for (const alias of aliases) {
      const index = headerLower.indexOf(alias)
      if (index !== -1) {
        // Use original case from headers
        mapping[standardCol as StandardColumn] = headers[index]
        break
      }
    }
  }

  // Check if required columns are present
  const missingColumns: StandardColumn[] = []
  for (const required of REQUIRED_COLUMNS) {
    if (!mapping[required]) {
      missingColumns.push(required)
    }
  }

  return {
    success: missingColumns.length === 0,
    mapping: Object.keys(mapping).length > 0 ? mapping : undefined,
    missingColumns: missingColumns.length > 0 ? missingColumns : undefined,
    foundHeaders: headers,
  }
}

/**
 * Build SQL column aliases for SELECT statement
 */
export function buildColumnAliases(mapping: ColumnMapping): string {
  const aliases: string[] = []

  for (const [standard, original] of Object.entries(mapping)) {
    if (original !== standard) {
      aliases.push(`"${original}" AS ${standard}`)
    } else {
      aliases.push(standard)
    }
  }

  return aliases.join(', ')
}
