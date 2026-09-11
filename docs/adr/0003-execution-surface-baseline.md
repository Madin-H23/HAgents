# ADR-0003 执行面基线：可验证的 AgentBackend / BaseAgent / AgentEvent

## Status

Accepted（2026-09-11）— Spec [#1](https://github.com/Madin-H23/HAgents/issues/1)，验收票 [#2](https://github.com/Madin-H23/HAgents/issues/2)–[#5](https://github.com/Madin-H23/HAgents/issues/5)

## Context

HAgents 定位是高阶执行面架构学习/改造（ADR-0002）。在本 ADR 之前，本机无 Bun，上游核心测试与 `typecheck:shared` 跑不起来——执行面「能读、不能验」，后续任何 fork 改造都缺少红绿安全网，也无法用证据回答「问题 / 实现 / 取舍 / 局限」。

上游权威 runner 是 **Bun**（`bun:test`、workspace 脚本均依赖它）；用 Node 冒充会丢失测试语义。

## Decision

在既有 seams 上建立执行面验证基线，**不改上游业务语义**（ADR-0001），**不扩功能**：

1. 安装 Bun 到本机偏好路径 `D:\Develop\bun`，以 `bun install` + 既有 scripts 作为唯一验证入口。
2. 固定三条验证线并写入可复现命令：
   - **S1 factory** — connection → ClaudeAgent/PiAgent 装配
   - **S1 AgentEvent** — tool-matching + claude/pi/base event-adapter
   - **S2 BaseAgent** — 模板基类 + core/{permission,source,session-lifecycle}
3. headless 测试环境缺口只做**环境播种**（见 Consequences），禁止为绿灯改业务语义或测试断言。

### 问题 → 实现（源码指针）

| 问题 | 实现 | 指针 |
|------|------|------|
| UI/会话层如何不感知 SDK 差异？ | `AgentBackend` 接口：`chat(): AsyncGenerator<AgentEvent>` + abort/handoff | `packages/shared/src/agent/backend/types.ts:337` |
| 事件如何统一为单一事实来源？ | `AgentEvent` 可辨识联合（文本、工具起止、权限、错误、完成…） | `packages/core/src/types/message.ts:550` |
| 后端如何按配置装配？ | `createBackend` switch：`anthropic`→`ClaudeAgent`，`pi`→`PiAgent` | `packages/shared/src/agent/backend/factory.ts:132` |
| 权限/Source/Prompt/用量横切只实现一次？ | `BaseAgent implements AgentBackend`，持有 PermissionManager / SourceManager / PromptBuilder / UsageTracker | `packages/shared/src/agent/base-agent.ts:164` |
| Provider 差异落在哪？ | 子类只做 SDK 映射：`ClaudeAgent`、`PiAgent` | `packages/shared/src/agent/claude-agent.ts:477`、`pi-agent.ts:165` |
| SDK 消息如何变成 AgentEvent？ | tool-matching + base/claude/pi event-adapter（toolIndex 父子匹配、retry/overflow 恢复状态机） | `packages/shared/src/agent/__tests__/tool-matching*.test.ts`、`*event-adapter*.test.ts` |

### 取舍

1. **抽象 AgentBackend 而非为每个厂商开 runtime** — 新厂商优先走既有 Pi 路径；代价是 Pi 适配层要维护事件/重试状态机。
2. **BaseAgent 模板方法** — 横切只写一次，避免 Claude/Pi 漂移；代价是子类必须严格遵守模板钩子，不能绕过 Permission/Source。
3. **硬中止 vs 交接中断分语义** — 真取消用 hard abort；计划提交/鉴权等 pause point 用 handoff interrupt（见 `CONTEXT.md`）。
4. **事件单一来源在 core** — 面层禁止另造平行 `AgentEvent`；注意 `packages/shared/src/automations/types.ts:25` 的同名类型**不是**同一事物，引用须带包路径。
5. **验证用 Bun 而非 Node** — 与上游 runner 一致；本机不用 Node 跑 `bun:test`。

### 局限

- 基线只覆盖 **shared 执行面 S1/S2**；Electron/WebUI/CLI、全量 monorepo 测试不在范围（Spec #1 Out of Scope）。
- Claude 构造依赖 `~/.craft-agent/config-defaults.json`：headless 下 `ensureConfigDir()` 未被调用时会 throw。本基线用 bundled 文件播种，**不改 `loadConfigDefaults` 业务路径**。
- 上游既有 skip 保留：`initializeBackendHostRuntime throws for dist-style host root in dev`（dev runtime 下不测 dist 路径）。
- `@vscode/ripgrep` postinstall 在无 GitHub token 时可能 403；与执行面测试无关，可用 `gh auth token` 重试 install。
- 本 ADR 记录的是**可验证基线**，不是改造方案；后续改造须另开 ADR 并保持本基线绿。

## 验收命令与实测结论（2026-09-11）

环境：Bun `1.4.2` @ `D:\Develop\bun\bin\bun.exe`；工作树 `develop` @ `2044aaf1`；零业务 diff。

```powershell
# 依赖 + 环境播种（见 #2 comment）
bun run typecheck:shared
# -> exit 0

cd packages\shared

# S1 factory (#3)
bun test src/agent/backend/__tests__/factory.test.ts
# -> 37 pass, 1 skip, 0 fail

# S1 AgentEvent (#4)
bun test `
  src/agent/__tests__/tool-matching.test.ts `
  src/agent/__tests__/tool-matching-sdk-fixtures.test.ts `
  src/agent/__tests__/claude-event-adapter.test.ts `
  src/agent/__tests__/pi-event-adapter.test.ts `
  src/agent/__tests__/base-event-adapter.test.ts
# -> 199 pass, 0 fail

# S2 BaseAgent + core (#5)
bun test `
  src/agent/__tests__/base-agent.test.ts `
  src/agent/__tests__/base-agent-source-activation.test.ts `
  src/agent/core/__tests__/permission-manager.test.ts `
  src/agent/core/__tests__/source-manager.test.ts `
  src/agent/core/__tests__/session-lifecycle.test.ts
# -> 101 pass, 0 fail
```

失败定性汇总：

| 现象 | 定性 | 处理 |
|------|------|------|
| factory 2 fail（缺 `config-defaults.json`） | 环境：headless 未调用 `ensureConfigDir` | 播种 bundled 文件后全绿；未改代码 |
| factory 1 skip | 上游既有 | 保留 |
| lockfile 被本地 npm mirror 改写 | 环境噪音 | `git checkout -- bun.lock`，不提交 |

## Consequences

- 任何执行面 fork 改造先跑上述三线 + `typecheck:shared`，红绿证据写回对应 issue。
- 新 session/CI 需复述：装 Bun、`bun install`、播种 `config-defaults.json`、再跑命令。
- 术语一律用 `CONTEXT.md`；不引入第二套权限模式或第二套流式事件类型（除非另开 ADR）。
- 遵守 ADR-0001：不改名 `CRAFT_*` / 包名，保留 `LICENSE`+`NOTICE`。
