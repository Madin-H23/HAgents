# ADR-0006 Source 激活自动重启：drain 边界与 forceAbort

## Status

Accepted（2026-09-11）— Spec/票 [#19](https://github.com/Madin-H23/HAgents/issues/19)；上游动机 #790；术语锚点 `CONTEXT.md`「AgentEvent」「硬中止」

## Context

会话工具 `mcp__session__source_test` 成功激活 Source 后，必须结束当前 turn，让会话层用**新工具集**重发用户消息。naive 做法是「看到触发 `tool_result` 就 `forceAbort`」——会丢掉同一并行工具批里尚未 yield 的兄弟 `tool_result`，session journal 留下孤儿 `tool_use`，后续发送全被堵住（上游 #790）。

## Decision

**规则：Source 激活不是 handoff，是「排空后硬中止」。用 `SourceActivationDrainController` 推迟 abort，边界上 yield `source_activated` 再 `forceAbort(SourceActivated)`。**

| 问题 | 实现 | 指针 |
|------|------|------|
| 为何不能当场 abort？ | 并行 tool 批未排空 → 孤儿 tool_use | `source-activation-drain.ts` 头注释 |
| 如何排空？ | `observe()`：捕获首个 pending；drain 期间 return true（跳过 normal per-event 处理） | 同文件 `:87` |
| Claude 何时 fire？ | `'batch-boundary'`：整批 adapted 事件结束后 `shouldFireAtBoundary()` | 策略注释 + ClaudeAgent drain 调用 |
| Pi 何时 fire？ | `'fire-on-non-tool-result'`：捕获后首个非 `tool_result` 前 `shouldFireBeforeEvent()`（避免下一段 assistant 片段泄入 journal） | 同文件 `:68` |
| 之后如何停？ | yield `source_activated` + `forceAbort(AbortReason.SourceActivated)` | `claude-agent.ts` / `pi-agent.ts` |
| 并发 source_test？ | first-writer-wins；drain 中 `consumePending()` 清掉竞争 pending，保留第一个 slug | `base-agent.setPendingSourceActivationRestart` + drain `observe` |
| 与 handoff 界限？ | plan/auth → `interruptForHandoff`；Source 激活 → **hard** `forceAbort(SourceActivated)` | ADR-0004 |

### 取舍

1. **控制器显式化，而不是在 adapter 里散落 abort** — 两种策略可测、可指；代价是 agent 循环多一层 observe 钩子。
2. **Claude 按批、Pi 按非 tool_result 边界** — 对齐各自 adapter 形状；代价是策略不可混用。
3. **激活用 hard abort 而非 handoff** — 需要立刻停 turn 换工具，不是把控制权交给 UI 停等；与 ADR-0004 一致。
4. **不改 AgentEvent 形状** — `source_activated` 已是 core 联合成员；不引入第二套激活事件。

### 局限

- drain 只保护「激活瞬间」的并行批；激活前已发出的失败 tool_use 仍由会话层负责。
- `observe` 返回 true 会跳过 inactive-source / compaction / large-result 等 per-event 逻辑——drain 窗口内有意为之，窗口外必须恢复正常处理。
- 本 ADR 不覆盖 Electron 如何消费 `source_activated` 后重发消息。

## 验收命令与证据

```powershell
powershell -File scripts\seed-test-env.ps1
cd packages\shared
bun test `
  src/agent/__tests__/source-activation-drain.test.ts `
  src/agent/__tests__/base-agent-source-activation.test.ts `
  src/agent/__tests__/pi-agent-handoff.test.ts
```

实测（2026-09-11）：drain 控制器测试（batch-boundary / fire-on-non-tool-result）+ first-writer-wins 全绿；已纳入 `bun run test:exec-surface` contracts 段。

## Consequences

- 修改激活路径必须保持「排空 → `source_activated` → hard abort」顺序；禁止在 observe 窗口内再 fire。
- 新后端若 adapter 形状既非 Claude 批也非 Pi 1:1，需新增 `DrainPolicy` 并补测。
- OCR / check:arch 继续把 `SourceActivated` 当 hard abort reason（非 handoff）。
