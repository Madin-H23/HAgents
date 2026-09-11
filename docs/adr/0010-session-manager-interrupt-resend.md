# ADR-0010 SessionManager 中断与重发链路

## Status

Accepted（2026-09-11）— 票 [#25](https://github.com/Madin-H23/HAgents/issues/25)；接壤 ADR-0004/0006

## Context

执行面只提供 API；真正「选对 API、排队重发、防重」在 `server-core` 的 `SessionManager`。与面层（Electron）职责必须分清，否则会出现双份 auto-retry。

## Decision

**规则：SessionManager 是中断 API 的唯一会话层调用方；plan/auth 调 handoff，用户停止调 hard abort，Source 激活由 drain 事件驱动服务器侧重发。**

| 场景 | 会话层行为 | 指针 |
|------|------------|------|
| 计划提交 | `interruptForHandoff(PlanSubmitted)` | `SessionManager.ts:4082` |
| 鉴权请求 | `interruptForHandoff(AuthRequest)` | `:4141` |
| 用户停止 | `forceAbort(UserStop)` | `:5650`、`:6393` |
| 中流重定向 | 有 steer 则 `redirect()` 不 forceAbort；无则 backend 内 `forceAbort(Redirect)` 并 queue | `:5792` 附近注释 + ADR-0004 |
| Source 激活 | 执行面 drain 后 yield `source_activated` + hard abort；**服务器**消费事件并 schedule 重发（suffix `[slug activated]`、`autoRetryPending` 2s 去重） | `:8260` case `source_activated` |
| 排队 | `processNextQueuedMessage` | `:6697` |

### 与面层分工

- **服务器**：headless/WebUI 链式激活与重发（注释明确 renderer 不再自跑 auto_retry）。
- **Electron**：渲染激活反馈；历史版本可能仍 sendMessage → `autoRetryPending` 去重窗口。

### 取舍

1. **会话层集中选 API** — 执行面保持薄；代价是 SessionManager 巨大，改动须小步 + 测。
2. **激活重发放服务器** — 多端一致；代价是消息附加 `[slug activated]` 后缀，属可观察约定。
3. **2s 去重** — 兼容旧客户端；不是分布式锁。

### 局限

- 未做 Electron e2e；WS 断线重放不在本 ADR。
- 队列语义与 mid-stream queue/steer 细节见 CLAUDE.md shared（`resolveMidStreamBehavior`），此处只定中断/重发边界。

## 验收

证据：ADR-0004 handoff 测、ADR-0006 drain 测、SessionManager 调用面 grep（上表行号）。

## Consequences

- 新中断场景先分类 handoff/hard 再落 SessionManager；禁止 UI 与 server 双份自动重发。
- 改 `source_activated` 分支必须同步 drain 与 dedup 说明。
