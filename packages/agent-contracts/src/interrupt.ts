/**
 * Interrupt / abort reason contracts (ADR-0004, ADR-0006).
 *
 * Call sites should classify intent BEFORE choosing an API:
 * - handoff boundary → interruptForHandoff
 * - hard stop / redirect fallback / source-activation restart → forceAbort
 *
 * Source activation is hard abort AFTER drain (ADR-0006), not handoff.
 */

export const HANDOFF_ABORT_REASONS = ['plan_submitted', 'auth_request'] as const;

export const HARD_ABORT_REASONS = [
  'user_stop',
  'redirect',
  'source_activated',
  'timeout',
  'internal_error',
] as const;

export type HandoffAbortReason = (typeof HANDOFF_ABORT_REASONS)[number];
export type HardAbortReason = (typeof HARD_ABORT_REASONS)[number];

export function isHandoffAbortReason(reason: string): reason is HandoffAbortReason {
  return (HANDOFF_ABORT_REASONS as readonly string[]).includes(reason);
}

export function isHardAbortReason(reason: string): reason is HardAbortReason {
  return (HARD_ABORT_REASONS as readonly string[]).includes(reason);
}

/**
 * Returns the API that matches the documented contract.
 * Throws on unknown reasons so new AbortReason members fail loudly
 * instead of silently defaulting to hard abort.
 */
export function interruptApiForReason(
  reason: string,
): 'interruptForHandoff' | 'forceAbort' {
  if (isHandoffAbortReason(reason)) return 'interruptForHandoff';
  if (isHardAbortReason(reason)) return 'forceAbort';
  throw new Error(
    `Unknown AbortReason "${reason}" — classify as handoff or hard abort (ADR-0004) before choosing an API`,
  );
}

/** Source activation must never be classified as UI handoff (ADR-0006). */
export function assertSourceActivationIsHardAbort(reason: string): void {
  if (reason !== 'source_activated') return;
  if (!isHardAbortReason(reason)) {
    throw new Error('source_activated missing from HARD_ABORT_REASONS');
  }
  if (isHandoffAbortReason(reason)) {
    throw new Error('source_activated must be hard abort, not handoff');
  }
}
