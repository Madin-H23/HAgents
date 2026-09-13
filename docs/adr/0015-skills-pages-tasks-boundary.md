# ADR-0015 Skills / Pages / Tasks 边界（只读消化）

## Status

Accepted（2026-09-13）— 票 [#31](https://github.com/Madin-H23/HAgents/issues/31)；辅路径边界记录，**不扩功能**

## Context

三块上游约定极多（CLAUDE.md shared）：Skills 注册面、Pages 工作区实体与 Bun-only 数据层、Tasks 共享创建核心。HAgents 主战场是执行面；本 ADR 只固定「改这里必须知道什么」，避免误改。

## Decision

**规则：本仓不新增 Skills/Pages/Tasks 业务能力；引用上游单一入口；禁止旁路实现。**

### Skills

| 约定 | 指针 |
|------|------|
| 可发现指令包，与 Source 并列进会话工具面 | CONTEXT「Skill」；`shared/skills` |
| PreToolUse 对 skill 文件直写可 block | ADR-0009 / pre-tool-use transforms |

### Pages

| 约定 | 指针 |
|------|------|
| 工作区实体 `pages/{slug}/`：page.json + index.html + data/ | shared CLAUDE.md Pages 节 |
| **`pages/data-store.ts` 仅 Bun**（`bun:sqlite`）；禁止 re-export 出 barrel / 禁止 Electron main 直接 import | 同上 |
| 数据写路径经 `writePageData` 生成一次性脚本（Node 安全） | `pages/data-write.ts` |
| 工具 safe-mode：读 Explore-safe，写在 Explore 阻塞 | ADR-0009；session-tools-core defs |

### Tasks

| 约定 | 指针 |
|------|------|
| `createTaskFromSpec` / `finishTaskOrchestrator` 为共享核心；禁止在 tool/RPC 再实现一套 | shared CLAUDE.md Tasks 节 |
| Task label 族 `TASK-<slug>-<N>` 经 `SessionManager.applyTaskLabel` | labels/crud + ADR-0014 过滤 |

### 取舍

1. **边界 ADR 而非改造** — 保持执行面叙事主轴；代价是本批无新门禁测（上游已有测，不重复抽）。
2. **只链指针** — 避免与上游 CLAUDE.md 双份维护细节。

### 局限

- Pages sharing / publisher / action-bridge 细节不在本 ADR 展开。
- 任何 Skills/Pages/Tasks **功能**改造须另开 Spec + ADR。

## 验收

文件本体 + ADR 索引更新；`validate:exec-surface` 仍绿（无新增测段）。

## Consequences

- 改这三块前先读 shared CLAUDE.md 对应节 + 本 ADR 指针。
- 禁止在 fork 中「顺手」绕过 createTaskFromSpec 或 data-store 边界。
