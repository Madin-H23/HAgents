# Seed ~/.craft-agent/config-defaults.json from bundled assets.
# Idempotent: safe to re-run. Required for headless bun test (ClaudeAgent ctor).
# Usage: powershell -File scripts/seed-test-env.ps1

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$src = Join-Path $repoRoot 'apps/electron/resources/config-defaults.json'
$cfgDir = Join-Path $env:USERPROFILE '.craft-agent'
$dst = Join-Path $cfgDir 'config-defaults.json'

if (-not (Test-Path $src)) {
  Write-Error "Bundled config-defaults not found: $src"
  exit 1
}

New-Item -ItemType Directory -Force -Path $cfgDir | Out-Null
Copy-Item -Force $src $dst
$hash = (Get-FileHash $dst -Algorithm SHA256).Hash
Write-Host "Seeded $dst"
Write-Host "  source: $src"
Write-Host "  sha256: $hash"
