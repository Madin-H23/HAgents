# AGENTS.md

HAgents — [lukilabs/craft-agents-oss](https://github.com/lukilabs/craft-agents-oss)（Apache-2.0）的 fork：高阶 Agent 工程架构位（AgentBackend 多后端、会话/工具面、多端协议）。
与家族分工：**HCode** = 极简 Harness + 桌面面；**HClaw** = 多渠道 Agent 工作台；**HAgents** = 吃透并改造 craft-agents 的高阶架构点，形成可讲清取舍的改造叙事。

## Agent skills

### Issue tracker

Issues 存放在 GitHub Issues（`gh` CLI 操作）。See `docs/agents/issue-tracker.md`.

### Triage labels

五个 canonical triage roles，label 字符串与 role 名相同。See `docs/agents/triage-labels.md`.

### Domain docs

Single-context：repo 根 `CONTEXT.md`（纯词汇表）+ `docs/adr/`。See `docs/agents/domain.md`.

## 必读

- `ARCHITECTURE.md` — 构架地图：apps/packages 分层、Agent 执行面主路径、与 HCode 的对照锚点，先读它再动代码
- 分支纪律：`main` 仅上游稳定态/里程碑；一切改造在 `develop`；大块改造走 `feature/<topic>`，`--no-ff` 合回 develop
- 上游同步约束见 `docs/adr/0001-fork-sync-discipline.md`
- 许可约束：Apache-2.0，分发与改造必须保留 `LICENSE` + `NOTICE`
- OCR 代码审查（open-code-review）：规则在 `.opencodereview/rule.json`，用法 `ocr delegate preview --rule .opencodereview/rule.json --from main --to develop --format json`（delegation 模式）
- headless 测试环境：先 `scripts/seed-test-env.ps1`（Windows）/ `scripts/seed-test-env.sh` 播种 `~/.craft-agent/config-defaults.json`，否则 ClaudeAgent 构造会因缺文件失败（见 ADR-0003）
- 执行面一键验证：`bun run validate:exec-surface`（check:arch + seed + typecheck + S1/S2/contracts）；拆分入口 `check:arch` / `test:exec-surface`
