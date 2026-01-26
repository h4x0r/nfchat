import { describe, it, expect } from 'vitest';
import {
  dashboardDataSchema,
  flowsResponseSchema,
  validateDashboardData,
  validateFlowsResponse,
  type DashboardData,
  type FlowsResponse,
} from '../responses';

describe('Response Schemas', () => {
  describe('dashboardDataSchema', () => {
    it('validates valid dashboard data', () => {
      const validData = {
        timeline: [{ time: 1234567890, attack: 'DoS', count: 100 }],
        attacks: [{ attack: 'DoS', count: 100 }],
        topSrcIPs: [{ ip: '10.0.0.1', value: 50 }],
        topDstIPs: [{ ip: '10.0.0.2', value: 30 }],
        flows: [{ id: 1, data: 'test' }],
        totalCount: 1000,
      };

      const result = dashboardDataSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('rejects missing required fields', () => {
      const invalidData = {
        timeline: [],
        attacks: [],
        // missing topSrcIPs, topDstIPs, flows, totalCount
      };

      const result = dashboardDataSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('rejects invalid timeline item', () => {
      const invalidData = {
        timeline: [{ time: 'not-a-number', attack: 'DoS', count: 100 }],
        attacks: [],
        topSrcIPs: [],
        topDstIPs: [],
        flows: [],
        totalCount: 0,
      };

      const result = dashboardDataSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('rejects invalid attack item', () => {
      const invalidData = {
        timeline: [],
        attacks: [{ attack: 123, count: 'not-a-number' }], // wrong types
        topSrcIPs: [],
        topDstIPs: [],
        flows: [],
        totalCount: 0,
      };

      const result = dashboardDataSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('accepts empty arrays', () => {
      const validData = {
        timeline: [],
        attacks: [],
        topSrcIPs: [],
        topDstIPs: [],
        flows: [],
        totalCount: 0,
      };

      const result = dashboardDataSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe('flowsResponseSchema', () => {
    it('validates valid flows response', () => {
      const validData = {
        flows: [{ id: 1 }, { id: 2 }],
        totalCount: 100,
      };

      const result = flowsResponseSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('rejects missing totalCount', () => {
      const invalidData = {
        flows: [],
        // missing totalCount
      };

      const result = flowsResponseSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('rejects non-array flows', () => {
      const invalidData = {
        flows: 'not-an-array',
        totalCount: 0,
      };

      const result = flowsResponseSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('validateDashboardData', () => {
    it('returns data when valid', () => {
      const validData = {
        timeline: [],
        attacks: [],
        topSrcIPs: [],
        topDstIPs: [],
        flows: [],
        totalCount: 0,
      };

      const result = validateDashboardData(validData);
      expect(result).toEqual(validData);
    });

    it('throws on invalid data', () => {
      const invalidData = { timeline: 'bad' };

      expect(() => validateDashboardData(invalidData)).toThrow(
        /Invalid dashboard data/
      );
    });
  });

  describe('validateFlowsResponse', () => {
    it('returns data when valid', () => {
      const validData = {
        flows: [{ id: 1 }],
        totalCount: 1,
      };

      const result = validateFlowsResponse(validData);
      expect(result).toEqual(validData);
    });

    it('throws on invalid data', () => {
      const invalidData = { totalCount: 'bad' };

      expect(() => validateFlowsResponse(invalidData)).toThrow(
        /Invalid flows response/
      );
    });
  });

  describe('Type inference', () => {
    it('DashboardData type matches schema', () => {
      // This test verifies TypeScript inference works correctly
      const data: DashboardData = {
        timeline: [{ time: 123, attack: 'test', count: 1 }],
        attacks: [{ attack: 'test', count: 1 }],
        topSrcIPs: [{ ip: '10.0.0.1', value: 1 }],
        topDstIPs: [{ ip: '10.0.0.2', value: 1 }],
        flows: [{}],
        totalCount: 1,
      };

      const result = dashboardDataSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('FlowsResponse type matches schema', () => {
      const data: FlowsResponse = {
        flows: [{}],
        totalCount: 1,
      };

      const result = flowsResponseSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });
});
