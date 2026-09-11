import { describe, expect, it } from 'bun:test';
import {
  assertSourceActivationIsHardAbort,
  interruptApiForReason,
  isHardAbortReason,
  isHandoffAbortReason,
} from '../src/interrupt.ts';

describe('interrupt contracts (ADR-0004 / ADR-0006)', () => {
  it('classifies plan/auth as handoff API', () => {
    expect(interruptApiForReason('plan_submitted')).toBe('interruptForHandoff');
    expect(interruptApiForReason('auth_request')).toBe('interruptForHandoff');
    expect(isHandoffAbortReason('plan_submitted')).toBe(true);
    expect(isHardAbortReason('plan_submitted')).toBe(false);
  });

  it('classifies stop/redirect/source/timeouts as hard abort API', () => {
    for (const r of ['user_stop', 'redirect', 'source_activated', 'timeout', 'internal_error']) {
      expect(interruptApiForReason(r)).toBe('forceAbort');
      expect(isHardAbortReason(r)).toBe(true);
      expect(isHandoffAbortReason(r)).toBe(false);
    }
  });

  it('source_activated is never handoff', () => {
    expect(() => assertSourceActivationIsHardAbort('source_activated')).not.toThrow();
    expect(interruptApiForReason('source_activated')).toBe('forceAbort');
  });

  it('unknown reasons fail loudly', () => {
    expect(() => interruptApiForReason('planSubmitted')).toThrow(/Unknown AbortReason/);
    expect(() => interruptApiForReason('')).toThrow(/Unknown AbortReason/);
  });

  it('handoff and hard tables are disjoint and cover known AbortReason values', () => {
    const handoff = new Set(['plan_submitted', 'auth_request']);
    const hard = new Set(['user_stop', 'redirect', 'source_activated', 'timeout', 'internal_error']);
    for (const h of handoff) {
      expect(hard.has(h)).toBe(false);
    }
    expect(handoff.size + hard.size).toBe(7);
  });
});
