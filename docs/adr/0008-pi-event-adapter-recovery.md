# ADR-0008 Pi event-adapter 恢复状态机

## Status

Accepted（2026-09-11）— 票 [#23](https://github.com/Madin-H23/HAgents/issues/23)

## Context

Pi SDK 在 `agent_end` 之后仍可能继续：**上下文溢出自动压缩**（`_runAutoCompaction` + `agent.continue()`）与 **可重试错误自动退避重跑**（`auto_retry_*`）。若 adapter 在每次 `agent_end` 都 `complete()` 队列，恢复 turn 会丢事件或提前结束消费端。

## Decision

**规则：`PiEventAdapter` 用两套正交状态机持有 turn，直到恢复成功/失败/超时或 hard abort；`shouldCompleteQueue` 是唯一 complete 闸。**

| 问题 | 实现 | 指针 |
|------|------|------|
| overflow 状态 | `none→held→awaiting→compacting→recovering→none` | `backend/pi/event-adapter.ts` `overflowState` |
| auto-retry 状态 | `none→held→awaitingRetry→backoff→recovering→none` | 同文件 `retryState` 注释块 `:140` |
| 何时 complete？ | `shouldCompleteQueue`：`pendingQueueComplete` 或（`agent_end` 且两机皆 `none`） | `:193` |
| 硬中止必须清场 | `resetRecoveryState()`：取消 fallback timer、清 held/pending | `:206`；`PiAgent.forceAbort`/`abortTurnLocal` 调用 |
| 谁驱动 complete？ | `PiAgent.handleSubprocessEvent` 问 `shouldCompleteQueue` | `pi-agent.ts` |
| 错误如何露出 | 可重试错误 **park**，恢复失败/耗尽才一次 `typed_error`；成功则 `retry` backoff/active/end | adapter `auto_retry_*` 分支 |

### 取舍

1. **状态机在 adapter，而不是 SDK 外再包一层 loop** — 事件 1:1 适配与恢复耦合在同一处；代价是 adapter 较大、必须有独立测试。
2. **fallback timer** — SDK 未按约定发 `compaction_start`/`auto_retry_start` 时强制收口；代价是定时器与主循环并发，靠 callback 注入 `setRecoveryFallbackHandlers`。
3. **与 hard abort 正交** — 真取消走 `resetRecoveryState`，避免 stale hold 泄漏到下一 turn（ADR-0004）。

### 局限

- 状态机细节绑定 Pi SDK 事件序；上游改序需同步本文件与 `pi-event-adapter.test.ts`。
- 不覆盖 Claude 路径（Claude 无此子进程恢复语义）。
- Electron 端「Retrying…」UI 不在本 ADR 范围。

## 验收

```powershell
cd packages\shared
bun test src/agent/__tests__/pi-event-adapter.test.ts
# 已纳入 test:exec-surface S1 与 contracts 语义（恢复用例在 S1 文件内）
```

## Consequences

- 修改 Pi 事件序必须跑 `pi-event-adapter.test.ts` + `validate:exec-surface`。
- 新 recovery 场景优先扩状态机枚举与 `shouldCompleteQueue` 条件，禁止旁路 complete。
