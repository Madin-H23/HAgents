import { describe, expect, it } from 'bun:test';
import {
  assertStreamAgentEvent,
  isAutomationHookName,
  isStreamAgentEvent,
} from '../src/agent-event.ts';

describe('AgentEvent isolation contracts (ADR-0005)', () => {
  it('stream events are objects with type', () => {
    expect(isStreamAgentEvent({ type: 'text_delta', text: 'hi' })).toBe(true);
    expect(isStreamAgentEvent({ type: 'complete' })).toBe(true);
    expect(isStreamAgentEvent('PreToolUse')).toBe(false);
    expect(isStreamAgentEvent(null)).toBe(false);
  });

  it('automation hooks are strings', () => {
    expect(isAutomationHookName('PreToolUse')).toBe(true);
    expect(isAutomationHookName('Stop')).toBe(true);
    expect(isAutomationHookName({ type: 'Stop' })).toBe(false);
  });

  it('assertStreamAgentEvent rejects hook names', () => {
    expect(() => assertStreamAgentEvent('PreToolUse')).toThrow(/not a stream AgentEvent/);
    expect(() => assertStreamAgentEvent({ type: 'text_delta', text: 'x' })).not.toThrow();
  });
});
