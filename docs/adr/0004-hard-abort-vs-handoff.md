# ADR-0004 硬中止 vs 交接中断：执行面中断语义

## Status

Accepted（2026-09-11）— Spec [#7](https://github.com/Madin-H23/HAgents/issues/7)、票 [#10](https://github.com/Madin-H23/HAgents/issues/10)；术语锚点 `CONTEXT.md`「硬中止 vs 交接中断」

## Context

`AgentBackend` 同时暴露 `forceAbort(reason)` 与 `interruptForHandoff(reason)`，二者都消费 `AbortReason`，但语义不同。若混用：

- 计划提交/鉴权被当成硬拆，SDK 子进程被 SIG 掉，UI 拿不到可恢复的 pause point；
- 真取消被当成 soft interrupt，turn 不结束、权限/工具 pending 泄漏。

`AbortReason` 枚举把 **why** 与 **how hard** 揉在同一平面，读者容易误以为「所有 abort 同等强度」。本 ADR 固定两条路径的边界与实现差异。

## Decision

**规则：会话层按意图选 API，后端按能力实现差异；`AbortReason` 只表达 why，不表达力度。**

| 意图 | API | 典型 reason | 期望副作用 |
|------|-----|-------------|------------|
| 真取消 / 拆除 / 换 turn | `forceAbort` | `UserStop`、`Redirect`、`SourceActivated`、`Timeout`、`InternalError` | 拒绝 pending 权限、拒绝/丢弃 pending 工具、complete 队列、清理恢复状态；必要时通知子进程 abort |
| 控制权移交 UI（pause point） | `interruptForHandoff` | `PlanSubmitted`、`AuthRequest` | 结束当前 turn 的生成，但不按「最硬 primitive」拆 SDK；便于 UI 展示 plan/auth 后续交互 |

### 问题 → 实现（源码指针）

| 问题 | 实现 | 指针 |
|------|------|------|
| 接口如何区分？ | `AgentBackend.forceAbort`（hard-stop 注释）与 `interruptForHandoff`（handed to the UI 注释）并列 | `packages/shared/src/agent/backend/types.ts:370`、`:388` |
| 默认实现是什么？ | `BaseAgent.interruptForHandoff` 默认委托 `forceAbort`；子类可 override | `packages/shared/src/agent/base-agent.ts:1094` |
| Claude 如何 override？ | handoff 走 SDK `query.interrupt()`；hard abort 走 `AbortController.abort` | `packages/shared/src/agent/claude-agent.ts:2773`、`:2793` |
| Pi 如何分叉？ | 同入口 `forceAbort` 内：`PlanSubmitted`/`AuthRequest` **只** complete 队列，不向子进程发 `abort`；其余 reason 再 `send({type:'abort'})` | `packages/shared/src/agent/pi-agent.ts:2324`、`:2355` |
| pause point 从哪来？ | session MCP 工具完成：`SubmitPlan` / auth 工具 → UI 回调 → `interruptForHandoff` | `packages/shared/src/agent/base-agent.ts:425`–`:476` |
| 会话层如何记 why？ | `AbortReason` + `set/consume/wasUserAbort`；`shouldClearSessionOnAbort` 仅在首条且无内容时清 | `packages/core` 经 `shared/agent/core/session-lifecycle.ts:22`、`:206` |

### 取舍

1. **同一枚举、两个入口**，而不是拆成两套 enum — 降低会话层/面层心智负担；代价是 reason 与力度无类型级耦合，靠约定 + OCR/ADR 约束。
2. **Claude handoff 用 cooperative interrupt** — 避免 AbortController 在 control-write 中途被拆；代价是 Claude 与 Pi 的 handoff 代码路径不同，但都满足「turn 结束、会话可续」。
3. **Pi 把 handoff 特判收在 `forceAbort` 内** — 而不是仅依赖 `BaseAgent` 默认委托：子进程无需收到 abort 即可结束 turn，避免误杀；代价是 `forceAbort` 承担双职责，读代码必须看 reason 分支。
4. **默认 handoff = hard abort** — 新后端即使不 override 也不会把 turn 挂死；代价是「语义正确」的 handoff 需要子类自觉 override（Claude 已做）。
5. **不把 handoff 做成新事件类型** — 仍走 turn 结束 + 既有 UI 回调；避免第二套流式协议（ADR-0003）。

### 局限

- `forceAbort` 对 `PlanSubmitted`/`AuthRequest` 的静默特判（Pi）是 **provider 内聚** 的，调用方无法从类型上区分「这次 forceAbort 其实是 handoff」——依赖会话层正确选 API。
- `BaseAgent` 默认委托使「未 override 的新后端」在 handoff 时表现为 hard abort：功能正确、语义偏硬。
- 本 ADR 不规定 UI 侧 plan/auth 卡片交互，只规定执行面中断边界。
- 验证证据来自 S2 单测（委托默认行为、lifecycle），不包含 Electron 端到端 pause 流。

## 验收命令与证据

```powershell
powershell -File scripts\seed-test-env.ps1
cd packages\shared
bun test `
  src/agent/__tests__/base-agent.test.ts `
  src/agent/core/__tests__/session-lifecycle.test.ts
# base-agent: 含「should delegate handoff interrupts to forceAbort by default」
# session-lifecycle: AbortReason 枚举值、set/consume、shouldClearSessionOnAbort
```

实测（2026-09-11，Spec #1/#5 基线）：S2 相关 **101 pass / 0 fail**。

## Consequences

- 新 `AgentBackend` 实现：若 handoff 语义 ≠ hard abort，必须 override `interruptForHandoff`；review 检查 reason 分支。
- 会话层新增中断场景时：先分类为 hard vs handoff，再选 API；禁止一律 `forceAbort`。
- OCR 规则已收录「硬中止 vs 交接中断不得混用」（`.opencodereview/rule.json` → `packages/shared/src/agent/**`）。
- 术语一律用 `CONTEXT.md`；与 ADR-0002/0003 一致，本 ADR 不改事件类型或权限模式。
