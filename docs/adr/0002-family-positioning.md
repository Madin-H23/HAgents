# 家族定位：HAgents = 高阶架构学习/改造位

## Status

Accepted（2026-09-11）

## Context

h-family 三仓需互补，避免叙事与改造面重叠：HCode 已是极简 Harness + 桌面面；HClaw 是多渠道 Agent 工作台。Craft Agents 提供了完整多后端（Claude SDK + Pi）、会话/工具/权限与多端（Electron/WebUI/CLI）实现，适合作为「高阶架构」锚点，但若与 HCode 抢桌面面主叙事会削弱组合价值。

## Decision

- HAgents 定位为 **高阶 Agent 工程架构学习与改造位**：优先消化 Agent 执行面（`shared/agent` + `pi-agent-server`）与会话/工具面（`session-tools-core`、`session-mcp-server`、sessions 存储），多端面仅作对照、不作为本仓差异化主战场。
- 首批候选改造/深挖主题锚点：AgentBackend / BaseAgent / AgentEvent（对照内参 R03/R04/R10），会话隔离与 Session tool context（R08/R17）为辅。
- 改造叙事必须能回答：问题、实现、取舍、局限；不能讲清的点降级为「只读消化」。

## Consequences

- `ARCHITECTURE.md` 以执行面为主路径书写；Electron/WebUI 只画边界。
- 简历/面试材料从本仓实际源码路径出发，不编造未实现能力。
- 与 HCode 的对照表保持更新，防止两仓术语漂移（见 `CONTEXT.md` 家族共享词）。
