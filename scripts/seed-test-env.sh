#!/usr/bin/env bash
# Seed ~/.craft-agent/config-defaults.json from bundled assets.
# Idempotent: safe to re-run. Required for headless bun test (ClaudeAgent ctor).
# Usage: bash scripts/seed-test-env.sh
set -euo pipefail
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
src="$repo_root/apps/electron/resources/config-defaults.json"
cfg_dir="${HOME}/.craft-agent"
dst="$cfg_dir/config-defaults.json"

if [[ ! -f "$src" ]]; then
  echo "Bundled config-defaults not found: $src" >&2
  exit 1
fi

mkdir -p "$cfg_dir"
cp -f "$src" "$dst"
echo "Seeded $dst"
echo "  source: $src"
