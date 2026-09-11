# HAgents Architecture

Craft Agents（lukilabs fork）的构架地图。目标：说清 **apps/packages 如何分层**、**Agent 执行面主路径**、以及 **与 HCode 的对照锚点**。动手前先读本文件 + `CONTEXT.md`。

## 1. Monorepo 总览

```
apps/                          # 用户面（Surface）
  electron/                    # 桌面三进程（main / preload / renderer）
  webui/                       # 浏览器面（复用 server-core）
  cli/                         # 一次性/终端面
  viewer/                      # 只读查看面

packages/
  core/                        # 类型层（轻依赖）：message / session / workspace / server types
  shared/                      # 业务逻辑层：agent 后端、sessions、sources、skills、credentials、config…
  server-core/                 # 服务层：RPC handlers、sessions、tasks、transport
  server/                      # 可部署 server 入口
  ui/                          # 跨面 UI 组件
  session-tools-core/          # 会话工具定义与 handlers
  session-mcp-server/          # 会话作用域 MCP 暴露
  pi-agent-server/             # Pi 后端子进程侧
  messaging-gateway/           # 外发消息网关（含自动化会话绑定）
  messaging-whatsapp-worker/   # WhatsApp worker
```

分工原则（与内参 R01/R02 一致）：

| 包 | 职责 | 硬约束 |
|----|------|--------|
| `core` | 稳定类型 + 少量 utils | 依赖极轻；改类型需查下游 `shared`/`apps` |
| `shared` | Agent、会话、Source/Skill、凭据、配置 | 权限模式固定 `safe`/`ask`/`allow-all`；Source 类型固定 `mcp`/`api`/`local` |
| `server-core` / `server` | RPC、任务、传输 | 面层不直接摸存储实现 |
| `session-tools-core` | 工具定义 + handler，注入 session tool context | 工具不得直接摸全局状态 |
| `apps/*` | 面 | 消费统一协议/事件，不复制策略 |

## 2. Agent 执行面（主路径，优先深挖）

```
Surface (electron renderer / webui / cli)
        │  AgentEvent 流（core types）
        ▼
SessionManager（server-core / shared sessions）
        │  选后端、绑工作区、持久化
        ▼
AgentBackend 接口（shared/agent/backend/types.ts）
        │  chat(): AsyncGenerator<AgentEvent>
        ├──────────────────┬──────────────────┐
        ▼                  ▼                  │
   ClaudeAgent          PiAgent               │  BaseAgent 子类
   (Claude Agent SDK)   (进程外 Pi SDK)        │
        │                  │                  │
        └──────── BaseAgent 横切 ─────────────┘
                  PermissionManager / SourceManager
                  PromptBuilder / UsageTracker / PrerequisiteManager
```

关键类型与文件：

- **AgentEvent** — `packages/core` types：单一事实来源；面层禁止另造平行事件类型。流式文本、工具起止、权限请求、错误、完成统一在此。
- **AgentBackend** — `packages/shared/src/agent/backend/types.ts`：`chat` / `abort` / `forceAbort` / `interruptForHandoff` / 可选 `setBackgroundEventSink`。
- **BaseAgent** — `packages/shared/src/agent/base-agent.ts`：模板基类，抽公共横切；子类只做 provider 差异。
- **ClaudeAgent** — `packages/shared/src/agent/claude-agent.ts`：SDK 消息 → AgentEvent（tool-matching + event adapter）。
- **PiAgent** — `packages/shared/src/agent/pi-agent.ts`：子进程 JSONL/事件适配；`packages/pi-agent-server` 为进程侧（model-resolution、session-settings、system-prompt-override 等）。

设计取舍（改造时必答）：

1. **为何抽象 AgentBackend** — UI 与会话层不感知 SDK 差异；新厂商优先走既有 Pi 路径，而不是再开一个 runtime。
2. **为何 BaseAgent 做模板方法** — 权限、Source、Prompt、用量横切只实现一次；避免 Claude/Pi 各自漂移。
3. **硬中止 vs 交接中断** — 真取消/拆除用 hard abort；计划提交、鉴权等 pause point 用 handoff interrupt。
4. **AgentEvent 与 automations 的 AgentEvent** — automations 域有同名事件枚举（PreToolUse 等），与 core 的流式 AgentEvent 不是同一类型；引用时必须带包路径。

## 3. 会话 / 工具面（辅路径）

- **会话**：落盘与索引在 `shared/sessions`；工作区配置在 `shared/workspaces` / projects。
- **Session tool context**：`shared/agent/session-scoped-tools.ts` 等，把 sessionId、工作区、回调注入工具。
- **session-tools-core**：工具 defs + handlers；Explore/safe 模式元数据决定可写工具是否暴露。
- **session-mcp-server**：将会话能力以 MCP 形式再暴露。
- **Source / Skill / MCP**：`shared/sources`、`shared/skills`、`shared/mcp`；统一进工具注册面。

## 4. 多端面（对照，非本仓主战场）

- `apps/electron`：main / preload / renderer + transport；与 HCode `desktop/` 对照，差异在 Craft 的 IPC channel map、会话 UI、Source/Skill 面板。
- `apps/webui` + `server-core` webui：同一服务层多端复用。
- HCode 对照锚点：HCode 是「一张 Harness、多张面」；Craft 是「多包 monorepo + 统一事件/协议」。HAgents 学的是后者的包边界与事件契约，不是再做一个桌面壳。

## 5. 与 HCode 的对照表

| 关注点 | HCode | HAgents（Craft） |
|--------|-------|------------------|
| 定位 | 极简 Harness | 高阶架构/多后端/多端 monorepo |
| 循环 | Pi `agentLoop` + 策略钩子 | BaseAgent 模板 + Claude/Pi 双后端 |
| 事件 | 运行时消息/工具结果 | `AgentEvent` 可辨识联合（core） |
| 权限 | allow/ask/deny 闸门 | `safe`/`ask`/`allow-all` + PreToolUse 管线 |
| 会话 | JSONL + SQLite 索引 | sessions 模块（见 shared/sessions） |
| 桌面 | `desktop/`（规划/推进中） | `apps/electron`（上游成熟） |
| 工具 | 内置 7 + MCP + 子代理 | Native + Source + Skill + session tools + MCP |

## 6. 决策记录索引（docs/adr/）

| ADR | 主题 |
|-----|------|
| 0001 | Fork 同步纪律（零语义 diff） |
| 0002 | 家族定位：执行面为主战场 |
| 0003 | 执行面可验证基线（Bun / S1 / S2 / typecheck） |
| 0004 | 硬中止 vs 交接中断（Claude/Pi override） |
| 0005 | Session tool context 与 AgentEvent 双类型隔离 |
| 0006 | Source 激活 drain 与 forceAbort(SourceActivated) |
| 0007 | AgentBackend factory 装配与扩展边界 |

**Fork 本地包（非上游）**：`packages/agent-contracts`（`@hagents/agent-contracts`）——中断/AgentEvent 契约运行时护栏，实现 ADR-0004/0005/0006 的可复用判定；上游 `packages/*` 语义仍零 diff。

## 7. 动手检查清单

1. 改动落在哪一层？类型 → `core`；横切/业务 → `shared`；RPC → `server-core`；面 → `apps/*`。
2. 是否引入了第二个事件类型或第二套权限模式？（禁止，除非 ADR）
3. 是否违反 fork-sync（改名上游标识 / 动 `CRAFT_*` 语义）？见 ADR-0001。
4. 术语是否符合 `CONTEXT.md`？
5. 提交后是否跑 OCR？规则 `.opencodereview/rule.json`。
6. headless 跑 `bun test` 前是否播种过 `config-defaults.json`？`powershell -File scripts/seed-test-env.ps1`（或 `bash scripts/seed-test-env.sh`）。
7. 改动执行面/事件/中断/Source 激活后：`bun run validate:exec-surface`（= `check:arch` + `test:exec-surface`）。
8. 中断 API：plan/auth 用 `interruptForHandoff`；真取消用 `forceAbort`；Source 激活在 drain 边界后 `forceAbort(SourceActivated)`（ADR-0004/0006）。
