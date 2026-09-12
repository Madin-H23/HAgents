# ADR-0012 pi-agent-server 子进程面边界

## Status

Accepted（2026-09-12）— 票 [#28](https://github.com/Madin-H23/HAgents/issues/28)；对照 ADR-0007/0008

## Context

`PiAgent`（shared，宿主）与 `pi-agent-server`（子进程）通过 **JSONL / 事件流** 协作。子进程侧还有模型解析、会话 settings、ephemeral query、搜索工具等。若宿主与子进程各自为政，重试/超时/鉴权会漂移。

## Decision

**规则：子进程拥有 Pi SDK 真实循环与进程内资源；宿主拥有会话编排与 Craft 事件契约。重试/超时策略集中在 `session-settings`，禁止回落到 SDK 默认 `SettingsManager.create(cwd)`。**

| 关注点 | 子进程实现 | 指针 |
|--------|------------|------|
| 模型解析 | `resolvePiModel` + not-found/rejection 分类 | `model-resolution.ts` |
| 主会话 vs 工具会话 settings | `CRAFT_PI_RETRY_SETTINGS` / `CRAFT_PI_EPHEMERAL_*`；`buildCraftPiSettings(purpose)` | `session-settings.ts` |
| 在内存 settings | `createCraftSettingsManager` — **不**读 cwd 下 `.pi/settings.json` | 同文件 + shared CLAUDE.md |
| ephemeral query | `EphemeralQueryCoordinator`：超时/取消/requestId 隔离；deadline = RPC 超时 − 5s | `ephemeral-query-lifecycle.ts` |
| system prompt 覆盖 | `applySystemPromptOverride` | `system-prompt-override.ts` |
| 自定义 endpoint 模型 | `normalizeCustomEndpointModelEntry` / overrides 显式传递 | `custom-endpoint-models.ts` |
| 凭据适配 | `adaptCredentialForPiSdk` | `adapt-credential.ts` |
| 工具（搜索等） | `createSearchTool` + 多 provider | `tools/search/` |

宿主侧：`packages/shared` `PiAgent` + `backend/pi/event-adapter`（恢复状态机见 ADR-0008）负责 Craft `AgentEvent` 与队列 complete。

### 取舍

1. **策略在子进程 settings** — 与 SDK 同进程，避免宿主再实现一套 backoff；代价是策略代码不在 shared，宿主只能经文档/常量对齐。
2. **ephemeral 与 main 分策略** — 工具查询更短 deadline、更小重试；代价是两套常量需同步 RPC 超时。
3. **禁止 SDK 默认 settings 路径** — 防止用户 cwd 配置污染 headless；代价是不能靠项目级 `.pi/settings.json` 调参。

### 局限

- 不覆盖 Electron 打包后的 interceptor bundle 路径（见 shared CLAUDE.md runtime-resolver）。
- Windows 子进程环境变量注入（Git Bash 等）在 shared `buildClaudeSubprocessEnv` / Pi 路径，不在本包展开。
- 本 ADR 为边界与关键模块地图，不替代 `session-settings` 源码注释。

## 验收

证据：`packages/pi-agent-server/src/{session-settings,model-resolution,ephemeral-query-lifecycle}.ts`；与 ADR-0008 adapter 恢复、ADR-0007「新厂商走 Pi」配套。

## Consequences

- 改重试/超时先改 `session-settings` 并说明与 host RPC 超时关系。
- 新 Pi 工具放 `tools/`，经会话工具面注册，不绕 Permission/PreToolUse 管线（ADR-0009）。
