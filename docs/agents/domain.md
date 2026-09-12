# Domain Docs

Engineering skills 探索 codebase 时，应如何消费这个 repo 的 domain documentation。

## Before exploring, read these

- repo 根目录的 **`CONTEXT.md`**
- **`docs/adr/`** — 读取与你即将处理区域相关的 ADRs
- **`ARCHITECTURE.md`** — 包边界与 Agent 执行面主路径

如果这些文件不存在，**静默继续**。不要标记缺失；不要提前建议创建。`/domain-modeling` skill（经由 `/grill-with-docs` 和 `/improve-codebase-architecture` 调用）会在 terms 或 decisions 实际被解决时懒创建它们。

## File structure

```
/
├── CONTEXT.md
├── ARCHITECTURE.md
├── docs/adr/
│   ├── 0001-fork-sync-discipline.md
│   ├── 0002-family-positioning.md
│   ├── 0003-execution-surface-baseline.md
│   ├── 0004-hard-abort-vs-handoff.md
│   ├── 0005-session-tool-context.md
│   ├── 0006-source-activation-drain.md
│   ├── 0007-agent-backend-factory.md
│   ├── 0008-pi-event-adapter-recovery.md
│   ├── 0009-pre-tool-use-permission-pipeline.md
│   ├── 0010-session-manager-interrupt-resend.md
│   ├── 0011-session-manager-midstream-queue.md
│   └── 0012-pi-agent-server-process.md
└── packages/ apps/
```

一键验证：`bun run check:arch`、`bun run test:exec-surface`（见 `AGENTS.md`）。

## Use the glossary's vocabulary

当你的输出命名某个 domain concept 时（issue title、refactor proposal、hypothesis、test name），使用 `CONTEXT.md` 中定义的 term。不要漂移到 glossary 明确避免的 synonyms。

如果你需要的概念还不在 glossary 中，这是一个信号：要么你正在发明项目没有使用的语言（重新考虑），要么确实存在缺口（为 `/domain-modeling` 记录）。

## Flag ADR conflicts

如果你的输出与现有 ADR 矛盾，明确指出，而不是静默覆盖：

> _Contradicts ADR-0001 (fork-sync discipline) — but worth reopening because…_
