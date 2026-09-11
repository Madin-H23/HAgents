# ADR-0009 PreToolUse 权限管线

## Status

Accepted（2026-09-11）— 票 [#24](https://github.com/Madin-H23/HAgents/issues/24)

## Context

工具执行前的闸门分散则会出现「模式说 block、Source 未激活仍放行」类漂移。Claude 与 Pi（多厂商）必须走**同一**规范化检查，再各自译成 SDK 钩子格式。

## Decision

**规则：所有后端在工具执行前调用 `runPreToolUseChecks()`；权限模式只认 `safe`/`ask`/`allow-all`（CONTEXT）；面层不得另造第二套模式。**

### 管线顺序（实现头注释）

1. **Permission mode** — 当前模式禁止的工具直接 block（`shouldAllowToolInMode` / `PERMISSION_MODE_CONFIG`）
2. **Source blocking** — 非激活 MCP/API Source 的工具 block（`evaluateMcpToolPolicy` 等）
3. **Prerequisite** — 未读 guide.md 前 block 对应 Source 工具
4. **call_llm 拦截** — 会话工具特殊路径
5. **输入变换** — 路径展开、config 校验、skill 限定、metadata 剥离
6. **Ask 模式** — `shouldPromptInAskMode` 决定是否要用户批准

| 关注点 | 指针 |
|--------|------|
| 主入口 | `packages/shared/src/agent/core/pre-tool-use.ts:700` `runPreToolUseChecks` |
| Ask 决策 | 同文件 `:1022` `shouldPromptInAskMode` |
| 会话白名单 | `core/permission-manager.ts`（session-scoped whitelist） |
| 测试 | `core/__tests__/pre-tool-use-checks.isolated.ts`；`__tests__/session-tool-safe-mode-permissions.test.ts` |

### 取舍

1. **集中 pipeline + 后端译码** — 避免 Claude/Pi 各写一半；代价是 `PreToolUseInput` 规范化要严谨。
2. **与 PermissionManager 横切分工** — Manager 管模式/白名单状态，pipeline 管单次工具决策；代价是两处都要读，不得绕过 pipeline 直接放行。
3. **安全默认** — 不确定 → block 或 ask，不静默 allow。

### 局限

- 不覆盖工具**执行中**的二次权限（permission_request 事件路径）。
- isolated 测试需独立进程跑（`*.isolated.ts`），已挂 runner。
- Electron 权限对话框 UI 不在本 ADR。

## 验收

```powershell
cd packages\shared
bun test src/agent/core/__tests__/pre-tool-use-checks.isolated.ts
bun test src/agent/__tests__/session-tool-safe-mode-permissions.test.ts
```

（已纳入 `test:exec-surface` contracts。）

## Consequences

- 新增工具默认进 pipeline；禁止在后端手写 `allow` 短路。
- 改权限模式语义必须同步 mode-manager + pipeline + CONTEXT + 基线测。
