/**
 * AgentEvent isolation contracts (ADR-0005).
 *
 * Core streaming events are discriminated objects.
 * Automations hook events are string-literal names.
 * They must never be conflated at a call site.
 */

import type { AgentEvent as StreamAgentEvent } from '@craft-agent/core';

/** Claude SDK / Craft automation hook names (not stream events). */
export const AUTOMATION_HOOK_NAMES = [
  'PreToolUse',
  'PostToolUse',
  'PostToolUseFailure',
  'Notification',
  'UserPromptSubmit',
  'SessionStart',
  'SessionEnd',
  'Stop',
  'SubagentStart',
  'SubagentStop',
  'PreCompact',
  'PermissionRequest',
  'Setup',
] as const;

export type AutomationHookName = (typeof AUTOMATION_HOOK_NAMES)[number];

export function isAutomationHookName(value: unknown): value is AutomationHookName {
  return typeof value === 'string' && (AUTOMATION_HOOK_NAMES as readonly string[]).includes(value);
}

export function isStreamAgentEvent(value: unknown): value is StreamAgentEvent {
  if (typeof value !== 'object' || value === null) return false;
  const t = (value as { type?: unknown }).type;
  return typeof t === 'string' && t.length > 0;
}

/**
 * Throws if a hook-name string is mistaken for a stream event (or vice versa).
 * Use at boundaries that accept untrusted event-shaped input.
 */
export function assertStreamAgentEvent(value: unknown, label = 'event'): void {
  if (isAutomationHookName(value)) {
    throw new Error(
      `${label}: automation hook name "${value}" is not a stream AgentEvent (ADR-0005)`,
    );
  }
  if (!isStreamAgentEvent(value)) {
    throw new Error(`${label}: expected stream AgentEvent object with type discriminant`);
  }
}
