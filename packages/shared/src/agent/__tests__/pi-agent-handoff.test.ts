import { describe, expect, it, mock } from 'bun:test'
import { PiAgent } from '../pi-agent.ts'
import { AbortReason } from '../backend/types.ts'

type Harness = {
  agent: any
  sends: Array<Record<string, unknown>>
}

function createHarness(): Harness {
  const agent = Object.create(PiAgent.prototype) as any
  const sends: Array<Record<string, unknown>> = []
  const pendingPermissions = new Map<string, { resolve: (v: boolean) => void }>()
  const pendingToolExecutions = new Map<string, { reject: (e: Error) => void }>()

  agent.pendingPermissions = pendingPermissions
  agent.pendingToolExecutions = pendingToolExecutions
  agent.eventQueue = { complete: mock(() => {}) }
  agent.adapter = { resetRecoveryState: mock(() => {}) }
  agent.preToolMetadataByCallId = { clear: mock(() => {}) }
  agent.emitAutomationEvent = mock(() => {})
  agent.abortReason = undefined
  agent._isProcessing = true
  agent.send = (cmd: Record<string, unknown>) => {
    sends.push(cmd)
  }

  return { agent, sends }
}

describe('PiAgent handoff vs hard abort (ADR-0004)', () => {
  it('interruptForHandoff(PlanSubmitted) does not abort the subprocess', () => {
    const { agent, sends } = createHarness()
    agent.interruptForHandoff(AbortReason.PlanSubmitted)
    expect(sends).toHaveLength(0)
    expect(agent.abortReason).toBe(AbortReason.PlanSubmitted)
    expect(agent._isProcessing).toBe(false)
    expect(agent.eventQueue.complete).toHaveBeenCalled()
    expect(agent.adapter.resetRecoveryState).toHaveBeenCalled()
  })

  it('interruptForHandoff(AuthRequest) does not abort the subprocess', () => {
    const { agent, sends } = createHarness()
    agent.interruptForHandoff(AbortReason.AuthRequest)
    expect(sends).toHaveLength(0)
    expect(agent.abortReason).toBe(AbortReason.AuthRequest)
  })

  it('forceAbort(UserStop) always sends abort to the subprocess', () => {
    const { agent, sends } = createHarness()
    agent.forceAbort(AbortReason.UserStop)
    expect(sends).toEqual([{ type: 'abort' }])
    expect(agent.abortReason).toBe(AbortReason.UserStop)
  })

  it('forceAbort is hard even for PlanSubmitted (contract: hard-stop only)', () => {
    const { agent, sends } = createHarness()
    agent.forceAbort(AbortReason.PlanSubmitted)
    expect(sends).toEqual([{ type: 'abort' }])
  })

  it('interruptForHandoff(Redirect) falls through to subprocess abort', () => {
    const { agent, sends } = createHarness()
    agent.interruptForHandoff(AbortReason.Redirect)
    expect(sends).toEqual([{ type: 'abort' }])
  })
})
