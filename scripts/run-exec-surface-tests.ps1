# Run execution-surface baseline: seed → typecheck:shared → S1 → S2 → contracts.
# Usage: powershell -File scripts/run-exec-surface-tests.ps1
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

if (-not (Get-Command bun -ErrorAction SilentlyContinue)) {
  Write-Error 'bun not on PATH (install to D:\Develop\bun and restart shell)'
  exit 1
}

Write-Host '==> seed-test-env'
powershell -File scripts\seed-test-env.ps1
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host '==> typecheck:shared'
bun run typecheck:shared
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Set-Location (Join-Path $repoRoot 'packages\shared')

Write-Host '==> S1 factory + tool-matching + event-adapters'
bun test `
  src/agent/backend/__tests__/factory.test.ts `
  src/agent/__tests__/tool-matching.test.ts `
  src/agent/__tests__/tool-matching-sdk-fixtures.test.ts `
  src/agent/__tests__/claude-event-adapter.test.ts `
  src/agent/__tests__/pi-event-adapter.test.ts `
  src/agent/__tests__/base-event-adapter.test.ts
if ($LASTEXITCODE -ne 0) { Write-Host 'S1 FAIL'; exit 1 }

Write-Host '==> S2 BaseAgent + core'
bun test `
  src/agent/__tests__/base-agent.test.ts `
  src/agent/__tests__/base-agent-source-activation.test.ts `
  src/agent/core/__tests__/permission-manager.test.ts `
  src/agent/core/__tests__/source-manager.test.ts `
  src/agent/core/__tests__/session-lifecycle.test.ts
if ($LASTEXITCODE -ne 0) { Write-Host 'S2 FAIL'; exit 1 }

Write-Host '==> contracts: handoff + AgentEvent isolation + source drain + pre-tool-use'
bun test `
  src/agent/__tests__/pi-agent-handoff.test.ts `
  src/agent/__tests__/claude-agent-handoff.test.ts `
  src/agent/__tests__/agent-event-isolation.test.ts `
  src/agent/__tests__/source-activation-drain.test.ts `
  src/agent/__tests__/session-tool-safe-mode-permissions.test.ts `
  ./src/agent/core/__tests__/pre-tool-use-checks.isolated.ts
if ($LASTEXITCODE -ne 0) { Write-Host 'contracts FAIL'; exit 1 }

Write-Host '==> sources/credentials contract pins'
bun test `
  src/sources/__tests__/source-config-validation.test.ts `
  src/sources/__tests__/server-builder-authScheme.test.ts `
  src/sources/__tests__/credential-manager-renew.test.ts `
  src/sources/__tests__/credential-manager-expiry.test.ts `
  src/sources/__tests__/api-tools-credential-freshness.test.ts
if ($LASTEXITCODE -ne 0) { Write-Host 'sources FAIL'; exit 1 }

Write-Host '==> exec-surface OK'
exit 0
