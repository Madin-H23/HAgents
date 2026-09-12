# ADR-0011 SessionManager 中流 queue/steer 与队列重放

## Status

Accepted（2026-09-12）— 票 [#27](https://github.com/Madin-H23/HAgents/issues/27)；接壤 ADR-0004/0010；术语 `CONTEXT.md`「会话」「硬中止 vs 交接中断」

## Context

用户在 Agent **仍在处理**时再发消息，不能一律 hard abort：有的连接适合 **steer**（插队进当前 turn），有的适合 **queue**（当前 turn 自然跑完再重放）。选错会导致「完整回答被打断」却注入 interruption 提醒，或队列饿死。

## Decision

**规则：中流发送由连接的 `midStreamBehavior`（`resolveMidStreamBehavior`）决定；queue 模式绝不 `redirect`/`forceAbort`；仅 steer 失败且后端已 abort 时才置 `wasInterrupted`。**

| 行为 | 会话层 | 指针 |
|------|--------|------|
| 解析策略 | `resolveMidStreamBehavior(connection)`；无 connection 时 fallback `'steer'` | `SessionManager.ts:5785`–`:5800` |
| `'steer'` | `agent.redirect(message)`；false 则后端已 `forceAbort(Redirect)`，进入队列 | 同文件 + ADR-0004 |
| `'queue'` | **跳过** redirect；当前 turn 不动 | `:5807` 注释 |
| 入队 | `managed.messageQueue.push(...)`；UI `status: queued` | `:5844`–`:5849` |
| `wasInterrupted` | **仅** steer 真中断时置位；纯 queue 不得置位（否则重放 turn 注入虚假「上次被打断」） | `:5850`–`:5855` |
| 重放 | turn 结束后 `processNextQueuedMessage` FIFO | `:6697` |
| 时间戳 | 中流 user message 用 queue 时刻；重放时 `monotonic()` 再戳，保证排序在上一 turn 完整回复之后 | CLAUDE.md shared / sendMessage |

### 取舍

1. **策略在连接级配置，而不是写死后端** — 同一 Pi/Claude 可按产品选择 queue/steer；代价是会话层多一处分支。
2. **queue 与 queue-after-abort 共用同一重放路径** — 实现简单；代价是靠 `wasInterrupted` 区分提醒注入。
3. **不在此层新造事件** — 仍用 `user_message` + `queued`/`accepted`（ADR-0003）。

### 局限

- 不覆盖 Electron 渲染层 optimistic UI 合并细节。
- steer 的 PreToolUse 仿真路径（Claude）只作引用，不在此 ADR 展开。
- 分布式多实例 SessionManager 队列不在此范围。

## 验收

证据：`SessionManager.ts:5785`–`:5855`、`:6697`；`resolveMidStreamBehavior` 见 shared CLAUDE.md；与 ADR-0004 redirect 回退、ADR-0010 source 重发并列。

## Consequences

- 新 provider 默认 `midStreamBehavior` 必须显式记录；禁止未解析时静默 hard abort。
- 修改队列重放须保持 `wasInterrupted` 不变量（queue-only 不置位）。
