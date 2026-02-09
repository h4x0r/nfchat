import { describe, it, expect, beforeEach } from 'vitest';
import { createHmmSlice } from './hmmSlice';
import { create, type StoreApi } from 'zustand';
import type { HmmSlice } from './types';

describe('hmmSlice', () => {
  let store: StoreApi<HmmSlice>;

  beforeEach(() => {
    store = create<HmmSlice>()(createHmmSlice);
  });

  describe('initial state', () => {
    it('hmmStates defaults to empty array', () => {
      expect(store.getState().hmmStates).toEqual([]);
    });

    it('hmmTraining defaults to false', () => {
      expect(store.getState().hmmTraining).toBe(false);
    });

    it('hmmProgress defaults to 0', () => {
      expect(store.getState().hmmProgress).toBe(0);
    });

    it('hmmError defaults to null', () => {
      expect(store.getState().hmmError).toBeNull();
    });

    it('tacticAssignments defaults to empty object', () => {
      expect(store.getState().tacticAssignments).toEqual({});
    });

    it('expandedState defaults to null', () => {
      expect(store.getState().expandedState).toBeNull();
    });

    it('hmmConverged defaults to null', () => {
      expect(store.getState().hmmConverged).toBeNull();
    });

    it('hmmIterations defaults to null', () => {
      expect(store.getState().hmmIterations).toBeNull();
    });

    it('hmmLogLikelihood defaults to null', () => {
      expect(store.getState().hmmLogLikelihood).toBeNull();
    });
  });

  describe('setHmmStates', () => {
    it('sets HMM state profiles', () => {
      const states = [
        {
          stateId: 0,
          flowCount: 100,
          avgInBytes: 500,
          avgOutBytes: 300,
          bytesRatio: 1.67,
          avgDurationMs: 2000,
          avgPktsPerSec: 10,
          protocolDist: { tcp: 0.8, udp: 0.15, icmp: 0.05 },
          portCategoryDist: { wellKnown: 0.6, registered: 0.3, ephemeral: 0.1 },
        },
      ];
      store.getState().setHmmStates(states);
      expect(store.getState().hmmStates).toEqual(states);
    });

    it('replaces previous states', () => {
      const first = [
        {
          stateId: 0,
          flowCount: 50,
          avgInBytes: 100,
          avgOutBytes: 100,
          bytesRatio: 1.0,
          avgDurationMs: 1000,
          avgPktsPerSec: 5,
          protocolDist: { tcp: 1, udp: 0, icmp: 0 },
          portCategoryDist: { wellKnown: 1, registered: 0, ephemeral: 0 },
        },
      ];
      const second = [
        {
          stateId: 1,
          flowCount: 200,
          avgInBytes: 800,
          avgOutBytes: 200,
          bytesRatio: 4.0,
          avgDurationMs: 5000,
          avgPktsPerSec: 20,
          protocolDist: { tcp: 0.5, udp: 0.5, icmp: 0 },
          portCategoryDist: { wellKnown: 0.2, registered: 0.5, ephemeral: 0.3 },
        },
      ];
      store.getState().setHmmStates(first);
      store.getState().setHmmStates(second);
      expect(store.getState().hmmStates).toEqual(second);
    });
  });

  describe('setHmmTraining', () => {
    it('sets training to true', () => {
      store.getState().setHmmTraining(true);
      expect(store.getState().hmmTraining).toBe(true);
    });

    it('sets training back to false', () => {
      store.getState().setHmmTraining(true);
      store.getState().setHmmTraining(false);
      expect(store.getState().hmmTraining).toBe(false);
    });
  });

  describe('setHmmProgress', () => {
    it('sets progress value', () => {
      store.getState().setHmmProgress(50);
      expect(store.getState().hmmProgress).toBe(50);
    });

    it('sets progress to 100', () => {
      store.getState().setHmmProgress(100);
      expect(store.getState().hmmProgress).toBe(100);
    });
  });

  describe('setHmmError', () => {
    it('sets error message', () => {
      store.getState().setHmmError('Training failed');
      expect(store.getState().hmmError).toBe('Training failed');
    });

    it('clears error', () => {
      store.getState().setHmmError('Error');
      store.getState().setHmmError(null);
      expect(store.getState().hmmError).toBeNull();
    });
  });

  describe('setTacticAssignment', () => {
    it('assigns tactic to a state', () => {
      store.getState().setTacticAssignment(0, 'Reconnaissance');
      expect(store.getState().tacticAssignments).toEqual({ 0: 'Reconnaissance' });
    });

    it('overwrites existing tactic assignment', () => {
      store.getState().setTacticAssignment(0, 'Reconnaissance');
      store.getState().setTacticAssignment(0, 'Lateral Movement');
      expect(store.getState().tacticAssignments).toEqual({ 0: 'Lateral Movement' });
    });

    it('assigns tactics to multiple states independently', () => {
      store.getState().setTacticAssignment(0, 'Reconnaissance');
      store.getState().setTacticAssignment(1, 'Exfiltration');
      store.getState().setTacticAssignment(2, 'Command and Control');
      expect(store.getState().tacticAssignments).toEqual({
        0: 'Reconnaissance',
        1: 'Exfiltration',
        2: 'Command and Control',
      });
    });
  });

  describe('setExpandedState', () => {
    it('sets expanded state', () => {
      store.getState().setExpandedState(2);
      expect(store.getState().expandedState).toBe(2);
    });

    it('clears expanded state', () => {
      store.getState().setExpandedState(2);
      store.getState().setExpandedState(null);
      expect(store.getState().expandedState).toBeNull();
    });
  });

  describe('setHmmConverged', () => {
    it('sets converged to true', () => {
      store.getState().setHmmConverged(true);
      expect(store.getState().hmmConverged).toBe(true);
    });

    it('sets converged to false', () => {
      store.getState().setHmmConverged(false);
      expect(store.getState().hmmConverged).toBe(false);
    });

    it('resets converged to null', () => {
      store.getState().setHmmConverged(true);
      store.getState().setHmmConverged(null);
      expect(store.getState().hmmConverged).toBeNull();
    });
  });

  describe('setHmmIterations', () => {
    it('sets iterations count', () => {
      store.getState().setHmmIterations(42);
      expect(store.getState().hmmIterations).toBe(42);
    });

    it('resets iterations to null', () => {
      store.getState().setHmmIterations(42);
      store.getState().setHmmIterations(null);
      expect(store.getState().hmmIterations).toBeNull();
    });
  });

  describe('setHmmLogLikelihood', () => {
    it('sets log likelihood value', () => {
      store.getState().setHmmLogLikelihood(-1234.56);
      expect(store.getState().hmmLogLikelihood).toBe(-1234.56);
    });

    it('resets log likelihood to null', () => {
      store.getState().setHmmLogLikelihood(-100);
      store.getState().setHmmLogLikelihood(null);
      expect(store.getState().hmmLogLikelihood).toBeNull();
    });
  });

  describe('resetHmm', () => {
    it('resets all HMM state to initial values', () => {
      // Set various state
      store.getState().setHmmStates([
        {
          stateId: 0,
          flowCount: 100,
          avgInBytes: 500,
          avgOutBytes: 300,
          bytesRatio: 1.67,
          avgDurationMs: 2000,
          avgPktsPerSec: 10,
          protocolDist: { tcp: 0.8, udp: 0.15, icmp: 0.05 },
          portCategoryDist: { wellKnown: 0.6, registered: 0.3, ephemeral: 0.1 },
        },
      ]);
      store.getState().setHmmTraining(true);
      store.getState().setHmmProgress(75);
      store.getState().setHmmError('Some error');
      store.getState().setTacticAssignment(0, 'Reconnaissance');
      store.getState().setExpandedState(0);
      store.getState().setHmmConverged(true);
      store.getState().setHmmIterations(50);
      store.getState().setHmmLogLikelihood(-1000);

      // Reset
      store.getState().resetHmm();

      // Verify all defaults
      expect(store.getState().hmmStates).toEqual([]);
      expect(store.getState().hmmTraining).toBe(false);
      expect(store.getState().hmmProgress).toBe(0);
      expect(store.getState().hmmError).toBeNull();
      expect(store.getState().tacticAssignments).toEqual({});
      expect(store.getState().expandedState).toBeNull();
      expect(store.getState().hmmConverged).toBeNull();
      expect(store.getState().hmmIterations).toBeNull();
      expect(store.getState().hmmLogLikelihood).toBeNull();
    });
  });
});
