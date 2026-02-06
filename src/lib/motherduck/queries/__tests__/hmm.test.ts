/**
 * Tests for HMM State Analysis Queries
 *
 * Verifies SQL generation, parameter sanitization, and batching logic.
 * The executeQuery function is mocked since these are unit tests.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the executor module before importing the module under test
vi.mock('../executor', () => ({
  executeQuery: vi.fn().mockResolvedValue([]),
}));

import { executeQuery } from '../executor';
import {
  extractFeatures,
  getStateSignatures,
  getSampleFlows,
  getStateTopHosts,
  getStateTimeline,
  getStateConnStates,
  getStatePortServices,
  writeStateAssignments,
  updateStateTactic,
  ensureHmmStateColumn,
} from '../hmm';
import type {
  FlowFeatureRow,
  StateSignatureRow,
  HostCount,
  TimelineBucket,
  ConnStateCount,
  PortCount,
  ServiceCount,
} from '../hmm';

const mockExecuteQuery = vi.mocked(executeQuery);

beforeEach(() => {
  mockExecuteQuery.mockReset();
  mockExecuteQuery.mockResolvedValue([]);
});

describe('HMM Query Module', () => {
  describe('extractFeatures', () => {
    it('generates SQL selecting all 12 features plus rowid', async () => {
      await extractFeatures();
      expect(mockExecuteQuery).toHaveBeenCalledTimes(1);
      const sql = mockExecuteQuery.mock.calls[0][0];

      // Verify all 12 feature columns are present
      expect(sql).toContain('LN(1 + IN_BYTES) as log1p_in_bytes');
      expect(sql).toContain('LN(1 + OUT_BYTES) as log1p_out_bytes');
      expect(sql).toContain('LN(1 + IN_PKTS) as log1p_in_pkts');
      expect(sql).toContain('LN(1 + OUT_PKTS) as log1p_out_pkts');
      expect(sql).toContain('LN(1 + FLOW_DURATION_MILLISECONDS) as log1p_duration_ms');
      expect(sql).toContain('LN(1 + COALESCE(SRC_TO_DST_IAT_AVG, 0)) as log1p_iat_avg');
      expect(sql).toContain('CAST(IN_BYTES AS DOUBLE) / (OUT_BYTES + 1) as bytes_ratio');
      expect(sql).toContain('CAST(IN_PKTS + OUT_PKTS AS DOUBLE) / GREATEST(FLOW_DURATION_MILLISECONDS / 1000.0, 0.001) as pkts_per_second');
      expect(sql).toContain('CASE WHEN PROTOCOL = 6 THEN 1 ELSE 0 END as is_tcp');
      expect(sql).toContain('CASE WHEN PROTOCOL = 17 THEN 1 ELSE 0 END as is_udp');
      expect(sql).toContain('CASE WHEN PROTOCOL = 1 THEN 1 ELSE 0 END as is_icmp');
      expect(sql).toContain('CASE WHEN L4_DST_PORT <= 1023 THEN 0 WHEN L4_DST_PORT <= 49151 THEN 1 ELSE 2 END as port_category');
      expect(sql).toContain('rowid');
    });

    it('does not include USING SAMPLE when no sampleSize is provided', async () => {
      await extractFeatures();
      const sql = mockExecuteQuery.mock.calls[0][0];
      expect(sql).not.toMatch(/USING SAMPLE/i);
    });

    it('includes USING SAMPLE when sampleSize is provided', async () => {
      await extractFeatures(50000);
      const sql = mockExecuteQuery.mock.calls[0][0];
      expect(sql).toContain('USING SAMPLE 50000 ROWS');
    });

    it('returns typed FlowFeatureRow results', async () => {
      const mockRow: FlowFeatureRow = {
        rowid: 1,
        log1p_in_bytes: 5.2,
        log1p_out_bytes: 3.1,
        log1p_in_pkts: 2.0,
        log1p_out_pkts: 1.5,
        log1p_duration_ms: 7.8,
        log1p_iat_avg: 4.3,
        bytes_ratio: 1.7,
        pkts_per_second: 45.2,
        is_tcp: 1,
        is_udp: 0,
        is_icmp: 0,
        port_category: 0,
      };
      mockExecuteQuery.mockResolvedValueOnce([mockRow]);

      const result = await extractFeatures();
      expect(result).toEqual([mockRow]);
    });
  });

  describe('getStateSignatures', () => {
    it('generates SQL with aggregate computations per HMM_STATE', async () => {
      await getStateSignatures();
      expect(mockExecuteQuery).toHaveBeenCalledTimes(1);
      const sql = mockExecuteQuery.mock.calls[0][0];

      expect(sql).toContain('HMM_STATE as state_id');
      expect(sql).toContain('COUNT(*) as flow_count');
      expect(sql).toContain('AVG(IN_BYTES) as avg_in_bytes');
      expect(sql).toContain('AVG(OUT_BYTES) as avg_out_bytes');
      expect(sql).toContain('AVG(CAST(IN_BYTES AS DOUBLE) / (OUT_BYTES + 1)) as bytes_ratio');
      expect(sql).toContain('AVG(FLOW_DURATION_MILLISECONDS) as avg_duration_ms');
      expect(sql).toContain('tcp_pct');
      expect(sql).toContain('udp_pct');
      expect(sql).toContain('icmp_pct');
      expect(sql).toContain('well_known_pct');
      expect(sql).toContain('registered_pct');
      expect(sql).toContain('ephemeral_pct');
      expect(sql).toContain('WHERE HMM_STATE IS NOT NULL');
      expect(sql).toContain('GROUP BY HMM_STATE');
      expect(sql).toContain('ORDER BY HMM_STATE');
    });
  });

  describe('getSampleFlows', () => {
    it('generates SQL filtering by HMM_STATE with safe parameterization', async () => {
      await getSampleFlows(3, 20);
      expect(mockExecuteQuery).toHaveBeenCalledTimes(1);
      const sql = mockExecuteQuery.mock.calls[0][0];

      expect(sql).toContain('HMM_STATE = 3');
      expect(sql).toContain('ORDER BY RANDOM()');
      expect(sql).toContain('LIMIT 20');
      expect(sql).toContain('IPV4_SRC_ADDR');
      expect(sql).toContain('IPV4_DST_ADDR');
      expect(sql).toContain('PROTOCOL');
      expect(sql).toContain('L4_DST_PORT');
    });

    it('uses default limit of 20', async () => {
      await getSampleFlows(1);
      const sql = mockExecuteQuery.mock.calls[0][0];
      expect(sql).toContain('LIMIT 20');
    });

    it('uses custom limit when provided', async () => {
      await getSampleFlows(1, 50);
      const sql = mockExecuteQuery.mock.calls[0][0];
      expect(sql).toContain('LIMIT 50');
    });
  });

  describe('getStateTopHosts', () => {
    it('executes two queries for source and destination IPs', async () => {
      mockExecuteQuery
        .mockResolvedValueOnce([{ ip: '10.0.0.1', count: 100 }])
        .mockResolvedValueOnce([{ ip: '10.0.0.2', count: 50 }]);

      const result = await getStateTopHosts(2, 5);

      expect(mockExecuteQuery).toHaveBeenCalledTimes(2);
      expect(result.srcHosts).toEqual([{ ip: '10.0.0.1', count: 100 }]);
      expect(result.dstHosts).toEqual([{ ip: '10.0.0.2', count: 50 }]);
    });

    it('filters by HMM_STATE in both queries', async () => {
      await getStateTopHosts(7);

      const srcSql = mockExecuteQuery.mock.calls[0][0];
      const dstSql = mockExecuteQuery.mock.calls[1][0];

      expect(srcSql).toContain('HMM_STATE = 7');
      expect(dstSql).toContain('HMM_STATE = 7');
      expect(srcSql).toContain('IPV4_SRC_ADDR as ip');
      expect(dstSql).toContain('IPV4_DST_ADDR as ip');
    });

    it('uses default limit of 5', async () => {
      await getStateTopHosts(1);
      const srcSql = mockExecuteQuery.mock.calls[0][0];
      expect(srcSql).toContain('LIMIT 5');
    });
  });

  describe('getStateTimeline', () => {
    it('generates time-bucketed SQL', async () => {
      await getStateTimeline(4, 60);
      expect(mockExecuteQuery).toHaveBeenCalledTimes(1);
      const sql = mockExecuteQuery.mock.calls[0][0];

      const bucketMs = 60 * 60000;
      expect(sql).toContain(`(FLOW_START_MILLISECONDS / ${bucketMs}) * ${bucketMs} as bucket`);
      expect(sql).toContain('HMM_STATE = 4');
      expect(sql).toContain('GROUP BY bucket');
      expect(sql).toContain('ORDER BY bucket');
    });

    it('defaults to 60 minute buckets', async () => {
      await getStateTimeline(0);
      const sql = mockExecuteQuery.mock.calls[0][0];
      const bucketMs = 60 * 60000;
      expect(sql).toContain(`${bucketMs}`);
    });
  });

  describe('getStateConnStates', () => {
    it('generates SQL for connection state distribution', async () => {
      await getStateConnStates(5);
      expect(mockExecuteQuery).toHaveBeenCalledTimes(1);
      const sql = mockExecuteQuery.mock.calls[0][0];

      expect(sql).toContain('CONN_STATE as state');
      expect(sql).toContain('COUNT(*) as count');
      expect(sql).toContain('HMM_STATE = 5');
      expect(sql).toContain('CONN_STATE IS NOT NULL');
      expect(sql).toContain('GROUP BY CONN_STATE');
      expect(sql).toContain('ORDER BY count DESC');
      expect(sql).toContain('LIMIT 10');
    });
  });

  describe('getStatePortServices', () => {
    it('executes two queries for ports and services', async () => {
      mockExecuteQuery
        .mockResolvedValueOnce([{ port: 80, count: 200 }])
        .mockResolvedValueOnce([{ service: 'http', count: 150 }]);

      const result = await getStatePortServices(3);

      expect(mockExecuteQuery).toHaveBeenCalledTimes(2);
      expect(result.ports).toEqual([{ port: 80, count: 200 }]);
      expect(result.services).toEqual([{ service: 'http', count: 150 }]);
    });

    it('filters by HMM_STATE and applies correct limits', async () => {
      await getStatePortServices(6);

      const portSql = mockExecuteQuery.mock.calls[0][0];
      const serviceSql = mockExecuteQuery.mock.calls[1][0];

      expect(portSql).toContain('HMM_STATE = 6');
      expect(portSql).toContain('L4_DST_PORT as port');
      expect(portSql).toContain('LIMIT 5');

      expect(serviceSql).toContain('HMM_STATE = 6');
      expect(serviceSql).toContain('SERVICE as service');
      expect(serviceSql).toContain("SERVICE IS NOT NULL AND SERVICE != ''");
      expect(serviceSql).toContain('LIMIT 5');
    });
  });

  describe('writeStateAssignments', () => {
    it('generates UPDATE with CASE statement for small batches', async () => {
      const assignments = new Map<number, number>([
        [1, 0],
        [2, 1],
        [3, 2],
      ]);

      await writeStateAssignments(assignments);
      expect(mockExecuteQuery).toHaveBeenCalledTimes(1);
      const sql = mockExecuteQuery.mock.calls[0][0];

      expect(sql).toContain('UPDATE flows SET HMM_STATE = CASE rowid');
      expect(sql).toContain('WHEN 1 THEN 0');
      expect(sql).toContain('WHEN 2 THEN 1');
      expect(sql).toContain('WHEN 3 THEN 2');
      expect(sql).toContain('END');
      expect(sql).toContain('WHERE rowid IN (1, 2, 3)');
    });

    it('batches large assignments into chunks of 1000', async () => {
      const assignments = new Map<number, number>();
      for (let i = 0; i < 2500; i++) {
        assignments.set(i, i % 5);
      }

      await writeStateAssignments(assignments);
      // 2500 / 1000 = 3 batches
      expect(mockExecuteQuery).toHaveBeenCalledTimes(3);
    });

    it('handles empty assignments without executing queries', async () => {
      const assignments = new Map<number, number>();
      await writeStateAssignments(assignments);
      expect(mockExecuteQuery).not.toHaveBeenCalled();
    });

    it('handles exactly 1000 entries in a single batch', async () => {
      const assignments = new Map<number, number>();
      for (let i = 0; i < 1000; i++) {
        assignments.set(i, i % 3);
      }
      await writeStateAssignments(assignments);
      // Exactly 1000 should fit in one batch
      expect(mockExecuteQuery).toHaveBeenCalledTimes(1);
    });

    it('splits 1001 entries into exactly 2 batches', async () => {
      const assignments = new Map<number, number>();
      for (let i = 0; i < 1001; i++) {
        assignments.set(i, i % 3);
      }
      await writeStateAssignments(assignments);
      expect(mockExecuteQuery).toHaveBeenCalledTimes(2);
    });
  });

  describe('updateStateTactic', () => {
    it('generates UPDATE with safe string escaping', async () => {
      await updateStateTactic(2, 'Reconnaissance');
      expect(mockExecuteQuery).toHaveBeenCalledTimes(1);
      const sql = mockExecuteQuery.mock.calls[0][0];

      expect(sql).toContain('UPDATE flows SET MITRE_TACTIC');
      expect(sql).toContain("'Reconnaissance'");
      expect(sql).toContain('HMM_STATE = 2');
    });

    it('escapes single quotes in tactic names', async () => {
      await updateStateTactic(1, "Command and Control's");
      const sql = mockExecuteQuery.mock.calls[0][0];
      // Single quotes should be escaped as double quotes in SQL
      expect(sql).toContain("Command and Control''s");
    });
  });

  describe('ensureHmmStateColumn', () => {
    it('generates ALTER TABLE with IF NOT EXISTS', async () => {
      await ensureHmmStateColumn();
      expect(mockExecuteQuery).toHaveBeenCalledTimes(1);
      const sql = mockExecuteQuery.mock.calls[0][0];

      expect(sql).toContain('ALTER TABLE flows ADD COLUMN IF NOT EXISTS HMM_STATE INTEGER');
    });
  });

  describe('type exports', () => {
    it('exports all required interfaces', () => {
      // These imports would fail at compile time if the types were not exported
      const featureRow: FlowFeatureRow = {
        rowid: 0,
        log1p_in_bytes: 0,
        log1p_out_bytes: 0,
        log1p_in_pkts: 0,
        log1p_out_pkts: 0,
        log1p_duration_ms: 0,
        log1p_iat_avg: 0,
        bytes_ratio: 0,
        pkts_per_second: 0,
        is_tcp: 0,
        is_udp: 0,
        is_icmp: 0,
        port_category: 0,
      };
      expect(featureRow).toBeDefined();

      const sig: StateSignatureRow = {
        state_id: 0,
        flow_count: 0,
        avg_in_bytes: 0,
        avg_out_bytes: 0,
        bytes_ratio: 0,
        avg_duration_ms: 0,
        avg_pkts_per_sec: 0,
        tcp_pct: 0,
        udp_pct: 0,
        icmp_pct: 0,
        well_known_pct: 0,
        registered_pct: 0,
        ephemeral_pct: 0,
      };
      expect(sig).toBeDefined();

      const host: HostCount = { ip: '', count: 0 };
      expect(host).toBeDefined();

      const bucket: TimelineBucket = { bucket: 0, count: 0 };
      expect(bucket).toBeDefined();

      const conn: ConnStateCount = { state: '', count: 0 };
      expect(conn).toBeDefined();

      const port: PortCount = { port: 0, count: 0 };
      expect(port).toBeDefined();

      const service: ServiceCount = { service: '', count: 0 };
      expect(service).toBeDefined();
    });
  });
});
