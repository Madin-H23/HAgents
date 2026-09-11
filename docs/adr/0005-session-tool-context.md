# ADR-0005 Session tool context 与 AgentEvent 双类型隔离

## Status

Accepted（2026-09-11）— Spec [#11](https://github.com/Madin-H23/HAgents/issues/11)、票 [#12](https://github.com/Madin-H23/HAgents/issues/12)；术语锚点 `CONTEXT.md`「会话工具上下文」「AgentEvent」

## Context

会话工具（`SubmitPlan`、source auth、session 自管理、pages、tasks…）必须绑定 **调用会话** 的 sessionId / 工作区 / 回调，且不得摸全局状态。上游实现分散在 registry、context factory、lazy bindings 三层；另有与流式 `AgentEvent` **同名** 的 automations 钩子事件，跨包引用极易混淆。

本 ADR 固定隔离模型与双类型边界，作为辅路径深挖证据（ADR-0002）。

## Decision

### 1. Session tool context：per-session registry + call-time lazy binding

**规则：工具 handler 只认 `SessionToolContext`；会话能力经 `sessionId` 键 registry 注入；对 session 自管理字段用非记忆化 getter，禁止会话创建时快照回调。**

| 问题 | 实现 | 指针 |
|------|------|------|
| 回调如何按会话隔离？ | `Map<sessionId, SessionScopedToolCallbacks>`：register / merge / unregister / get | `packages/shared/src/agent/session-scoped-tool-callback-registry.ts:99`、`:104`–`:139` |
| 为何 registry 从 tools 层拆出？ | 打断「Claude SDK 适配层 ↔ Claude/Pi 共用回调」的依赖 | 同文件头注释 `:4`–`:7` |
| 工具面如何装配？ | `getSessionScopedTools(sessionId, workspaceRootPath)` → MCP server；plan/auth 经 registry 回调上抛 | `packages/shared/src/agent/session-scoped-tools.ts:217` |
| Claude 全能力 context？ | `createClaudeContext` 组装 fs/validators/credentials/MCP validation 等接口 | `packages/shared/src/agent/claude-context.ts:91` |
| Claude/Pi 自管理如何共用？ | `attachSessionSelfManagementBindings`：每属性 `get() { return getSessionScopedToolCallbacks(sessionId)?.… }`，**无记忆化** | `packages/shared/src/agent/session-self-management-bindings.ts:34`–`:50` |
| #511 教训？ | Pi 路径曾漏挂 bindings → 会话自管理属性全 undefined；现两路共用同一 attach | 同文件 `:11`–`:13`；测试 `session-self-management-bindings.test.ts` |

**设计约束（已由测试钉死）**

1. 缺 callback → 属性 `undefined` / handler 返回明确 “not available”；**禁止** no-op 或假数据。
2. `mergeSessionScopedToolCallbacks` 必须在 **不重建 context** 的前提下立刻可见。
3. `getSessionInfo` 可对缺省 sessionId 做默认；其余 setter 透传显式 id。

### 2. AgentEvent：两个同名类型，包路径即边界

| 类型 | 包路径 | 形态 | 用途 |
|------|--------|------|------|
| 流式执行事件 | `@craft-agent/core` → `packages/core/src/types/message.ts:550` | 可辨识联合对象（`text_delta` / `tool_start` / …） | UI/会话层消费 `chat()` 产出 |
| 自动化钩子事件 | `packages/shared/src/automations/types.ts:25` | **字符串字面量联合**（`PreToolUse` / `Stop` / …） | AutomationSystem 匹配 Claude SDK hook 名 |

**规则：引用必须带包路径或局部别名；禁止互相 re-export；禁止在面层另造第三套流式事件（ADR-0003）。**

### 取舍

1. **进程内 Map registry，而非每会话独立进程** — 实现简单、与 Electron main 同寿命；代价是回调泄漏即会话工具可用性问题，必须 `unregister`（destroy 路径已挂）。
2. **lazy getter 而非构造时拷贝** — 支持 Electron SessionManager 后挂 browser/messaging 能力；代价是每次调用多一次 Map 查找（可忽略）。
3. **Claude/Pi 共用 attach，而不是 Pi 自抄一份** — 消灭 #511 类漂移；代价是 Pi 必须接受与 Claude 相同的绑定契约。
4. **保留双 `AgentEvent` 名，而不是改名 automations 一个** — 改名会扩大与上游 diff（ADR-0001）；代价是长期靠约定 + OCR 规则防混用。

### 局限

- Registry 无 TTL/容量上限；异常路径若漏 unregister 会残留回调（依赖 agent destroy）。
- `createClaudeContext` 名字含 Claude，但 bindings 已共用；历史命名未改（fork-sync）。
- AgentEvent 隔离目前是 **约定 + OCR**，没有编译期禁止跨包 import 的 fence。
- 本 ADR 不覆盖 session-tools-core 工具定义表本身，只覆盖 shared 侧注入面。

## 验收命令与实测结论（2026-09-11）

```powershell
powershell -File scripts\seed-test-env.ps1
cd packages\shared
bun test `
  src/agent/__tests__/session-scoped-tools-merge.test.ts `
  src/agent/__tests__/session-self-management-bindings.test.ts `
  src/agent/__tests__/session-tool-safe-mode-permissions.test.ts `
  src/agent/backend/claude/session-tool-parity.test.ts `
  src/agent/backend/pi/session-tool-parity.test.ts
# -> 15 pass, 0 fail
```

双类型定位：

```powershell
rg -n "export type AgentEvent" packages --glob '*.ts'
# packages/core/src/types/message.ts:550
# packages/shared/src/automations/types.ts:25
```

失败定性：无失败；无 skip。

## Consequences

- 新增会话工具能力：只扩展 `SessionScopedToolCallbacks` + context 字段 + handler，禁止在工具内直接摸全局。
- 修改自管理绑定必须保持「无记忆化 / 缺即 undefined」；改动同步 `session-self-management-bindings.test.ts`。
- OCR 已收录 automations AgentEvent 隔离规则（`.opencodereview/rule.json`）。
- 与 ADR-0002/0003/0004 一致：执行面主叙事仍以 AgentBackend/BaseAgent/AgentEvent 为主，本 ADR 为辅路径证据。
