# ADR-0013 Sources / Credentials 边界

## Status

Accepted（2026-09-12）— 票 [#29](https://github.com/Madin-H23/HAgents/issues/29)；辅路径（ADR-0002）；对齐 CONTEXT「Source」

## Context

Source 是外部能力接入单元，凭据与刷新分散在 SourceCredentialManager / TokenRefreshManager / server-builder。约定写在 CLAUDE.md，但 HAgents 侧缺**一键可复跑**的契约钉子，辅路径只读消化不够「可验」。

## Decision

**规则：Source 类型固定 `mcp`/`api`/`local`；凭据只走 credentials 路径；可刷新性以 `isRefreshableSource` 为唯一判定；API 执行单路径 `executeApiRequest`（不 log header 值）。**

| 关注点 | 实现 | 指针 |
|--------|------|------|
| 类型封闭 | `SourceType = 'mcp' \| 'api' \| 'local'` | `packages/shared/src/sources/types.ts:16` |
| 可刷新 | `isRefreshableSource`（OAuth / renew endpoint） | 同文件 `:234` |
| 凭据过期/提前刷新 | `isExpired` / `needsRefresh`（5 分钟阈值） | credential-manager；测 `credential-manager-expiry.test.ts` |
| renew endpoint | `refreshApiRenew`：字段名/模板/绝对 URL/TTL | `credential-manager-renew.test.ts` |
| authScheme | builder 默认 Bearer；空串/自定义保留 | `server-builder-authScheme.test.ts` |
| 多 header 配置校验 | production bug 回归（headerNames + authType none） | `source-config-validation.test.ts` |
| 每请求取新凭据 | getter 调用 vs 静态捕获 | `api-tools-credential-freshness.test.ts` |
| 与 PreToolUse | 未激活 Source 工具 block / `source_activation_needed` | ADR-0009 |
| 与会话 | 激活 drain 后 hard abort 重发 | ADR-0006/0010 |

### 门禁（B4a）

`test:exec-surface` 增加 **sources/credentials** 段（上列 5 个测试文件，实测 37 pass）。

### 取舍

1. **辅路径只钉契约测，不扩功能** — 保持主战场执行面；代价是 sources 全量 16 测未全入门禁（E2E/multi-header-e2e 等另跑）。
2. **类型与 isRefreshableSource 不改** — 避免上游语义 diff；一致性靠既有实现 + 测试。

### 局限

- OAuth relay、token-refresh-manager 全量、MCP server-builder E2E 未入本批门禁。
- Electron 凭据 UI / keychain 不在范围。

## 验收

```powershell
powershell -File scripts\seed-test-env.ps1
cd packages\shared
bun test src/sources/__tests__/source-config-validation.test.ts `
  src/sources/__tests__/server-builder-authScheme.test.ts `
  src/sources/__tests__/credential-manager-renew.test.ts `
  src/sources/__tests__/credential-manager-expiry.test.ts `
  src/sources/__tests__/api-tools-credential-freshness.test.ts
# 37 pass / 0 fail
```

## Consequences

- 改 Source 类型/刷新策略先跑上述门禁段。
- 新 auth 类型须同步 types、builder、validation 测试，禁止第二套凭据旁路。
