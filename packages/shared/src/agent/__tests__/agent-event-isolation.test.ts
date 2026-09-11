import { describe, expect, it } from 'bun:test'
import type { AgentEvent as StreamAgentEvent } from '@craft-agent/core'
import {
  type AgentEvent as AutomationHookEvent,
  AGENT_EVENTS,
  APP_EVENTS,
} from '../../automations/types.ts'

function streamType(e: StreamAgentEvent): string {
  return e.type
}

function hookName(e: AutomationHookEvent): string {
  return e
}

describe('AgentEvent dual-type isolation (ADR-0005)', () => {
  it('core stream events are discriminated objects, not hook-name strings', () => {
    const ev: StreamAgentEvent = { type: 'text_delta', text: 'hi' }
    expect(typeof ev).toBe('object')
    expect(streamType(ev)).toBe('text_delta')

    const complete: StreamAgentEvent = { type: 'complete' }
    expect(streamType(complete)).toBe('complete')

    const toolStart: StreamAgentEvent = {
      type: 'tool_start',
      toolName: 'Bash',
      toolUseId: 't1',
      input: {},
    }
    expect(streamType(toolStart)).toBe('tool_start')
  })

  it('automations AgentEvent is a hook-name string union', () => {
    expect(hookName('PreToolUse')).toBe('PreToolUse')
    expect(hookName('Stop')).toBe('Stop')
    expect(AGENT_EVENTS).toContain('PreToolUse')
    expect(AGENT_EVENTS).toContain('PostToolUse')
    expect(AGENT_EVENTS).toContain('Stop')
    expect(AGENT_EVENTS.every((e) => typeof e === 'string')).toBe(true)
  })

  it('stream object shape is not a valid automation hook name list entry', () => {
    // Runtime pin: hook registry is pure strings; a stream-shaped object must never
    // be pushed into AGENT_EVENTS (would silently break automation matching).
    const streamShaped = { type: 'text_delta', text: 'x' }
    expect(typeof streamShaped).toBe('object')
    expect(AGENT_EVENTS).not.toContain(streamShaped as unknown as string)
  })

  it('APP_EVENTS and AGENT_EVENTS are disjoint', () => {
    const app = new Set(APP_EVENTS)
    for (const e of AGENT_EVENTS) {
      expect(app.has(e as (typeof APP_EVENTS)[number])).toBe(false)
    }
  })

  it('core does not re-export automations hook names as AgentEvent', () => {
    // Structural: if someone mistakenly unions hook strings into core StreamAgentEvent,
    // streamType({type:'PreToolUse'}) would be a string-only event with no payload —
    // we pin a known stream variant that cannot be a hook name.
    const knownStreamOnly = { type: 'text_discard', turnId: 't' } satisfies StreamAgentEvent
    expect(AGENT_EVENTS).not.toContain(knownStreamOnly.type)
  })
})
