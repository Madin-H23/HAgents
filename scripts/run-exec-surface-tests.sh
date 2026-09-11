#!/usr/bin/env bash
# Run execution-surface baseline: seed → typecheck:shared → S1 → S2 → contracts.
# Usage: bash scripts/run-exec-surface-tests.sh
set -euo pipefail
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

if ! command -v bun >/dev/null 2>&1; then
  echo "bun not on PATH" >&2
  exit 1
fi

echo "==> seed-test-env"
bash scripts/seed-test-env.sh

echo "==> typecheck:shared"
bun run typecheck:shared

cd packages/shared

echo "==> S1 factory + tool-matching + event-adapters"
bun test \
  src/agent/backend/__tests__/factory.test.ts \
  src/agent/__tests__/tool-matching.test.ts \
  src/agent/__tests__/tool-matching-sdk-fixtures.test.ts \
  src/agent/__tests__/claude-event-adapter.test.ts \
  src/agent/__tests__/pi-event-adapter.test.ts \
  src/agent/__tests__/base-event-adapter.test.ts

echo "==> S2 BaseAgent + core"
bun test \
  src/agent/__tests__/base-agent.test.ts \
  src/agent/__tests__/base-agent-source-activation.test.ts \
  src/agent/core/__tests__/permission-manager.test.ts \
  src/agent/core/__tests__/source-manager.test.ts \
  src/agent/core/__tests__/session-lifecycle.test.ts

echo "==> contracts: handoff + AgentEvent isolation + source drain + pre-tool-use"
bun test \
  src/agent/__tests__/pi-agent-handoff.test.ts \
  src/agent/__tests__/claude-agent-handoff.test.ts \
  src/agent/__tests__/agent-event-isolation.test.ts \
  src/agent/__tests__/source-activation-drain.test.ts \
  src/agent/__tests__/session-tool-safe-mode-permissions.test.ts \
  ./src/agent/core/__tests__/pre-tool-use-checks.isolated.ts

echo "==> exec-surface OK"
