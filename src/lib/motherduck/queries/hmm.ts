/**
 * HMM State Analysis Queries
 *
 * DuckDB SQL queries for Hidden Markov Model feature extraction,
 * state signature computation, and state assignment management.
 */

import { executeQuery } from './executor';
import { WhereClauseBuilder } from '../../sql/builder';
import { escapeString } from '../../sql/escape';
import type { FlowRecord } from '../../schema';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Row returned by extractFeatures — 12 engineered features per flow. */
export interface FlowFeatureRow {
  rowid: number;
  log1p_in_bytes: number;
  log1p_out_bytes: number;
  log1p_in_pkts: number;
  log1p_out_pkts: number;
  log1p_duration_ms: number;
  log1p_iat_avg: number;
  bytes_ratio: number;
  pkts_per_second: number;
  is_tcp: number;
  is_udp: number;
  is_icmp: number;
  port_category: number;
}

/** Aggregate signature for a single HMM state. */
export interface StateSignatureRow {
  state_id: number;
  flow_count: number;
  avg_in_bytes: number;
  avg_out_bytes: number;
  bytes_ratio: number;
  avg_duration_ms: number;
  avg_pkts_per_sec: number;
  tcp_pct: number;
  udp_pct: number;
  icmp_pct: number;
  well_known_pct: number;
  registered_pct: number;
  ephemeral_pct: number;
}

/** IP address with occurrence count. */
export interface HostCount {
  ip: string;
  count: number;
}

/** Time-bucketed flow count. */
export interface TimelineBucket {
  bucket: number;
  count: number;
}

/** Connection state with occurrence count. */
export interface ConnStateCount {
  state: string;
  count: number;
}

/** Destination port with occurrence count. */
export interface PortCount {
  port: number;
  count: number;
}

/** Service name with occurrence count. */
export interface ServiceCount {
  service: string;
  count: number;
}

// ---------------------------------------------------------------------------
// Batch size for bulk writes
// ---------------------------------------------------------------------------

const BATCH_SIZE = 1000;

// ---------------------------------------------------------------------------
// 1. extractFeatures
// ---------------------------------------------------------------------------

/**
 * Extract the 12 HMM features per flow using SQL.
 *
 * Features include log-transformed byte/packet counts, duration, IAT,
 * byte ratio, packets-per-second, protocol one-hot, and port category.
 *
 * @param limit - Optional row limit for the query
 */
export async function extractFeatures(
  sampleSize?: number
): Promise<FlowFeatureRow[]> {
  const sampleClause = sampleSize !== undefined
    ? `\n    USING SAMPLE ${Number(sampleSize)} ROWS`
    : '';

  return executeQuery<FlowFeatureRow>(`
    SELECT
      rowid,
      LN(1 + IN_BYTES) as log1p_in_bytes,
      LN(1 + OUT_BYTES) as log1p_out_bytes,
      LN(1 + IN_PKTS) as log1p_in_pkts,
      LN(1 + OUT_PKTS) as log1p_out_pkts,
      LN(1 + FLOW_DURATION_MILLISECONDS) as log1p_duration_ms,
      LN(1 + COALESCE(SRC_TO_DST_IAT_AVG, 0)) as log1p_iat_avg,
      CAST(IN_BYTES AS DOUBLE) / (OUT_BYTES + 1) as bytes_ratio,
      CAST(IN_PKTS + OUT_PKTS AS DOUBLE) / GREATEST(FLOW_DURATION_MILLISECONDS / 1000.0, 0.001) as pkts_per_second,
      CASE WHEN PROTOCOL = 6 THEN 1 ELSE 0 END as is_tcp,
      CASE WHEN PROTOCOL = 17 THEN 1 ELSE 0 END as is_udp,
      CASE WHEN PROTOCOL = 1 THEN 1 ELSE 0 END as is_icmp,
      CASE WHEN L4_DST_PORT <= 1023 THEN 0 WHEN L4_DST_PORT <= 49151 THEN 1 ELSE 2 END as port_category
    FROM flows${sampleClause}
  `);
}

// ---------------------------------------------------------------------------
// 2. getStateSignatures
// ---------------------------------------------------------------------------

/**
 * Compute aggregate signatures per HMM state.
 *
 * Returns per-state averages for bytes, duration, packets-per-second,
 * as well as protocol and port-range distributions.
 */
export async function getStateSignatures(): Promise<StateSignatureRow[]> {
  return executeQuery<StateSignatureRow>(`
    SELECT
      HMM_STATE as state_id,
      COUNT(*) as flow_count,
      AVG(IN_BYTES) as avg_in_bytes,
      AVG(OUT_BYTES) as avg_out_bytes,
      AVG(CAST(IN_BYTES AS DOUBLE) / (OUT_BYTES + 1)) as bytes_ratio,
      AVG(FLOW_DURATION_MILLISECONDS) as avg_duration_ms,
      AVG(CAST(IN_PKTS + OUT_PKTS AS DOUBLE) / GREATEST(FLOW_DURATION_MILLISECONDS / 1000.0, 0.001)) as avg_pkts_per_sec,
      COUNT(CASE WHEN PROTOCOL = 6 THEN 1 END)::DOUBLE / COUNT(*) as tcp_pct,
      COUNT(CASE WHEN PROTOCOL = 17 THEN 1 END)::DOUBLE / COUNT(*) as udp_pct,
      COUNT(CASE WHEN PROTOCOL = 1 THEN 1 END)::DOUBLE / COUNT(*) as icmp_pct,
      COUNT(CASE WHEN L4_DST_PORT <= 1023 THEN 1 END)::DOUBLE / COUNT(*) as well_known_pct,
      COUNT(CASE WHEN L4_DST_PORT BETWEEN 1024 AND 49151 THEN 1 END)::DOUBLE / COUNT(*) as registered_pct,
      COUNT(CASE WHEN L4_DST_PORT >= 49152 THEN 1 END)::DOUBLE / COUNT(*) as ephemeral_pct
    FROM flows
    WHERE HMM_STATE IS NOT NULL
    GROUP BY HMM_STATE
    ORDER BY HMM_STATE
  `);
}

// ---------------------------------------------------------------------------
// 3. getSampleFlows
// ---------------------------------------------------------------------------

/**
 * Get a random sample of flows for a given HMM state.
 *
 * @param stateId - The HMM state to sample from
 * @param limit   - Maximum rows to return (default 20)
 */
export async function getSampleFlows(
  stateId: number,
  limit: number = 20
): Promise<Partial<FlowRecord>[]> {
  const where = new WhereClauseBuilder()
    .addCondition('HMM_STATE', '=', Number(stateId))
    .build();

  return executeQuery<Partial<FlowRecord>>(`
    SELECT
      IPV4_SRC_ADDR, IPV4_DST_ADDR, PROTOCOL, L4_DST_PORT,
      IN_BYTES, OUT_BYTES, FLOW_DURATION_MILLISECONDS,
      CONN_STATE, SERVICE, MITRE_TACTIC, MITRE_TECHNIQUE
    FROM flows
    WHERE ${where}
    ORDER BY RANDOM()
    LIMIT ${Number(limit)}
  `);
}

// ---------------------------------------------------------------------------
// 4. getStateTopHosts
// ---------------------------------------------------------------------------

/**
 * Get the top source and destination hosts for a given HMM state.
 *
 * @param stateId - The HMM state to query
 * @param limit   - Number of top hosts per direction (default 5)
 */
export async function getStateTopHosts(
  stateId: number,
  limit: number = 5
): Promise<{ srcHosts: HostCount[]; dstHosts: HostCount[] }> {
  const where = new WhereClauseBuilder()
    .addCondition('HMM_STATE', '=', Number(stateId))
    .build();

  const safeLimit = Number(limit);

  const srcHosts = await executeQuery<HostCount>(`
    SELECT IPV4_SRC_ADDR as ip, COUNT(*) as count
    FROM flows
    WHERE ${where}
    GROUP BY IPV4_SRC_ADDR
    ORDER BY count DESC
    LIMIT ${safeLimit}
  `);

  const dstHosts = await executeQuery<HostCount>(`
    SELECT IPV4_DST_ADDR as ip, COUNT(*) as count
    FROM flows
    WHERE ${where}
    GROUP BY IPV4_DST_ADDR
    ORDER BY count DESC
    LIMIT ${safeLimit}
  `);

  return { srcHosts, dstHosts };
}

// ---------------------------------------------------------------------------
// 5. getStateTimeline
// ---------------------------------------------------------------------------

/**
 * Get time-bucketed flow counts for an HMM state.
 *
 * @param stateId       - The HMM state to query
 * @param bucketMinutes - Time bucket size in minutes (default 60)
 */
export async function getStateTimeline(
  stateId: number,
  bucketMinutes: number = 60
): Promise<TimelineBucket[]> {
  const where = new WhereClauseBuilder()
    .addCondition('HMM_STATE', '=', Number(stateId))
    .build();

  const bucketMs = Number(bucketMinutes) * 60000;

  return executeQuery<TimelineBucket>(`
    SELECT
      (FLOW_START_MILLISECONDS / ${bucketMs}) * ${bucketMs} as bucket,
      COUNT(*) as count
    FROM flows
    WHERE ${where}
    GROUP BY bucket
    ORDER BY bucket
  `);
}

// ---------------------------------------------------------------------------
// 6. getStateConnStates
// ---------------------------------------------------------------------------

/**
 * Get connection state distribution for an HMM state.
 *
 * @param stateId - The HMM state to query
 */
export async function getStateConnStates(
  stateId: number
): Promise<ConnStateCount[]> {
  const where = new WhereClauseBuilder()
    .addCondition('HMM_STATE', '=', Number(stateId))
    .build();

  return executeQuery<ConnStateCount>(`
    SELECT CONN_STATE as state, COUNT(*) as count
    FROM flows
    WHERE ${where} AND CONN_STATE IS NOT NULL
    GROUP BY CONN_STATE
    ORDER BY count DESC
    LIMIT 10
  `);
}

// ---------------------------------------------------------------------------
// 7. getStatePortServices
// ---------------------------------------------------------------------------

/**
 * Get top destination ports and services for an HMM state.
 *
 * @param stateId - The HMM state to query
 */
export async function getStatePortServices(
  stateId: number
): Promise<{ ports: PortCount[]; services: ServiceCount[] }> {
  const where = new WhereClauseBuilder()
    .addCondition('HMM_STATE', '=', Number(stateId))
    .build();

  const ports = await executeQuery<PortCount>(`
    SELECT L4_DST_PORT as port, COUNT(*) as count
    FROM flows
    WHERE ${where}
    GROUP BY L4_DST_PORT
    ORDER BY count DESC
    LIMIT 5
  `);

  const services = await executeQuery<ServiceCount>(`
    SELECT SERVICE as service, COUNT(*) as count
    FROM flows
    WHERE ${where} AND SERVICE IS NOT NULL AND SERVICE != ''
    GROUP BY SERVICE
    ORDER BY count DESC
    LIMIT 5
  `);

  return { ports, services };
}

// ---------------------------------------------------------------------------
// 8. writeStateAssignments
// ---------------------------------------------------------------------------

/**
 * Bulk update flow HMM_STATE assignments.
 *
 * Generates UPDATE ... CASE statements in batches of 1000 to avoid
 * excessively large SQL statements.
 *
 * @param assignments - Map of rowid to HMM state id
 */
export async function writeStateAssignments(
  assignments: Map<number, number>
): Promise<void> {
  if (assignments.size === 0) {
    return;
  }

  const entries = Array.from(assignments.entries());

  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    const caseClauses = batch
      .map(([rowid, state]) => `WHEN ${Number(rowid)} THEN ${Number(state)}`)
      .join('\n      ');
    const rowids = batch.map(([rowid]) => Number(rowid)).join(', ');

    await executeQuery(`
      UPDATE flows SET HMM_STATE = CASE rowid
        ${caseClauses}
      END
      WHERE rowid IN (${rowids})
    `);
  }
}

// ---------------------------------------------------------------------------
// 9. updateStateTactic
// ---------------------------------------------------------------------------

/**
 * Update the MITRE_TACTIC for all flows in a given HMM state.
 *
 * Uses WhereClauseBuilder and escapeString for injection prevention.
 *
 * @param stateId - The HMM state to update
 * @param tactic  - The MITRE tactic name to set
 */
export async function updateStateTactic(
  stateId: number,
  tactic: string
): Promise<void> {
  const where = new WhereClauseBuilder()
    .addCondition('HMM_STATE', '=', Number(stateId))
    .build();

  const safeTactic = escapeString(tactic);

  await executeQuery(`
    UPDATE flows SET MITRE_TACTIC = '${safeTactic}'
    WHERE ${where}
  `);
}

// ---------------------------------------------------------------------------
// 10. ensureHmmStateColumn
// ---------------------------------------------------------------------------

/**
 * Add the HMM_STATE column to the flows table if it does not exist.
 */
export async function ensureHmmStateColumn(): Promise<void> {
  await executeQuery(`
    ALTER TABLE flows ADD COLUMN IF NOT EXISTS HMM_STATE INTEGER
  `);
}
