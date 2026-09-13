# ADR-0014 Sessions 存储与工作区绑定

## Status

Accepted（2026-09-13）— 票 [#30](https://github.com/Madin-H23/HAgents/issues/30)；辅路径（ADR-0002）；术语 `CONTEXT.md`「会话」「工作区」

## Context

会话是「绑定工作区与模型连接的持续对话落盘」。路径、元数据合并、权限模式字段与 label 过滤若散落，会出现过滤谓词分叉、恢复状态损坏。上游有单一谓词 `matchesLabelFilter`，HAgents 需可复跑钉子。

## Decision

**规则：会话路径以 workspace root + sessionId 派生；持久化字段以 SESSION_PERSISTENT_* 收敛；label 过滤只认 `matchesLabelFilter`。**

| 关注点 | 实现 | 指针 |
|--------|------|------|
| 路径 | `getSessionPath` / File / Attachments / Plans / Data / Downloads | `packages/shared/src/sessions/storage.ts:70`+ |
| 元数据合并 | persistence-queue header conflict / signature merge | `sessions/__tests__/persistence-queue.test.ts` |
| 权限模式字段 | `previousPermissionMode` 入 SESSION_PERSISTENT_FIELDS | `previous-permission-mode.test.ts` |
| **唯一 label 过滤谓词** | `matchesLabelFilter`（后代、`__all__`、projectId 作用域） | `packages/shared/src/labels/filter.ts:85`；测 `labels/__tests__/filter.test.ts` |
| 与执行面 | SessionManager 选后端/绑工作区；中断见 ADR-0010/0011 | ARCHITECTURE §2 |

### 取舍

1. **辅路径只钉标签过滤 + 持久化字段测**，不改存储语义（ADR-0001）。
2. **禁止手写 label 匹配**（CLAUDE.md shared）：过滤实现唯一，防 UI/列表漂移。

### 局限

- JSONL bundle、pending-plan 等未全入门禁。
- Electron 会话列表 UI 不在范围。

## 门禁

`test:exec-surface` 增 **sessions/labels** 段：`filter.test.ts` · `persistence-queue.test.ts` · `previous-permission-mode.test.ts`（实测 13 pass）。

## Consequences

- 改 label 过滤或持久化字段必须跑该段。
- 新 UI 过滤一律调用 `matchesLabelFilter`。
