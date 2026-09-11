# ADR-0007 AgentBackend factory 装配与扩展边界

## Status

Accepted（2026-09-11）— 票 [#20](https://github.com/Madin-H23/HAgents/issues/20)；证据票 #3；术语锚点 `CONTEXT.md`「AgentBackend」「后端实现」

## Context

会话层需要「按 connection/provider 得到 `AgentBackend`」，但不感知 Claude SDK vs Pi 子进程差异。上游同时提供：

- 直接 `createBackend(config)`（按 `provider` 构造）
- `createBackendFromConnection` / `createBackendFromResolvedContext`（连接记录与 host runtime 解析后的装配）

扩展若误做成「每个模型厂商一个 BaseAgent 子类」，横切（权限/Source/Prompt/用量）会开始漂移（ADR-0002/ARCHITECTURE 设计取舍 #1/#2）。

## Decision

**规则：`AgentBackend` 实例只从 factory 出；新厂商优先映射进既有 `pi` 路径，而不是新增 runtime。**

| 问题 | 实现 | 指针 |
|------|------|------|
| 如何按 provider 构造？ | `createBackend`：`anthropic`→`ClaudeAgent`，`pi`→`PiAgent`，未知抛错 | `packages/shared/src/agent/backend/factory.ts:132` |
| 别名？ | `createAgent === createBackend` | 同文件 `:152` |
| connection 类型如何落到 provider？ | `connectionTypeToProvider` / `providerTypeToAgentProvider`（openai→pi 等 legacy 路由） | factory + `#3` factory 测试 |
| 完整 host 装配？ | `createBackendFromResolvedContext` + driver registry | `factory.ts:158` |
| 为何不第三条 runtime？ | 权限/Source/Prompt 横切在 `BaseAgent` 只实现一次；新厂商走 Pi SDK/catalog | ARCHITECTURE §2 / CLAUDE.md shared |
| UI 如何解耦？ | 只依赖 `AgentBackend` 接口（`chat` 产 `AgentEvent` 流） | `backend/types.ts:337` |

### 取舍

1. **显式 switch + 后续 resolved-context 路径**，而不是一开始插件化 registry — 上游简单可读；代价是增加 provider 要改 factory（fork 中应优先加映射而非新类）。
2. **Pi 作为多厂商汇聚点** — Bedrock/OpenAI 兼容等走 Pi；代价是 Pi 适配与重试/overflow 状态机复杂度集中在 `pi-agent` + event-adapter。
3. **`createAgent` 别名保留** — 降低会话层迁移成本；新代码 prefer `createBackend`（注释约定）。
4. **auth 组合用 `isValidProviderAuthCombination` 集中校验** — 避免 factory 与连接 UI 各说各话。

### 局限

- 未知 `provider` 运行时抛错，不是编译期穷尽（`unknown as any` 测试路径仍在）。
- 新增真·独立 runtime（非 Pi）成本高：需新 `BaseAgent` 子类 + handoff/drain/权限横切全套。
- 本 ADR 不覆盖 credentials/UI 选型。

## 验收命令与证据

```powershell
cd packages\shared
bun test src/agent/backend/__tests__/factory.test.ts
# 37 pass, 1 skip, 0 fail（Spec #1 / 票 #3）
```

覆盖：detectProvider、createBackend→Claude/Pi、connection 映射、auth 组合、phase4 host runtime bootstrap。

## Consequences

- 改动 `createBackend` / provider 映射必须跑 factory 测试 + `test:exec-surface`。
- 新模型厂商：先映射 `providerType: 'pi'` + `piAuthProvider`；只有真正需要独立 runtime 时才开新 `BaseAgent` 子类并另开 ADR。
- OCR 规则 `packages/shared/src/agent/**` 继续约束横切不得在子类分叉。
