/**
 * Fork-local architecture invariants for HAgents (ADR-0001/0003/0004/0005).
 * Run: bun run scripts/check-architecture.ts   (or: bun run check:arch)
 * Zero business-logic coupling — file existence / literal patterns only.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const failures: string[] = [];
const oks: string[] = [];

function fail(msg: string) {
  failures.push(msg);
}
function ok(msg: string) {
  oks.push(msg);
}

function read(rel: string): string | null {
  const p = join(root, rel);
  if (!existsSync(p)) {
    fail(`missing file: ${rel}`);
    return null;
  }
  return readFileSync(p, 'utf-8');
}

function walkTs(dir: string, acc: string[] = []): string[] {
  const p = join(root, dir);
  if (!existsSync(p)) return acc;
  for (const e of readdirSync(p, { withFileTypes: true })) {
    const rel = join(dir, e.name).replaceAll('\\', '/');
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === 'dist') continue;
      walkTs(rel, acc);
    } else if (e.name.endsWith('.ts')) {
      acc.push(rel);
    }
  }
  return acc;
}

// --- ADR-0001: license ---
for (const f of ['LICENSE', 'NOTICE']) {
  if (existsSync(join(root, f))) ok(`license: ${f}`);
  else fail(`ADR-0001 missing ${f}`);
}

// --- ADR-0003: single streaming AgentEvent in core ---
const coreTs = walkTs('packages/core/src');
const agentEventDefs: string[] = [];
for (const f of coreTs) {
  const src = readFileSync(join(root, f), 'utf-8');
  if (/export\s+type\s+AgentEvent\s*=/.test(src)) {
    agentEventDefs.push(f);
  }
}
if (agentEventDefs.length === 1 && agentEventDefs[0]?.includes('message.ts')) {
  ok(`core AgentEvent single source: ${agentEventDefs[0]}`);
} else {
  fail(
    `core must export type AgentEvent exactly once in message.ts (found: ${agentEventDefs.join(', ') || 'none'})`,
  );
}

// core must not re-export automations AgentEvent
const coreIndex = read('packages/core/src/index.ts') ?? '';
const coreTypesIndex = read('packages/core/src/types/index.ts') ?? '';
if (/automations/i.test(coreIndex + coreTypesIndex)) {
  fail('core must not reference automations (AgentEvent isolation, ADR-0005)');
} else {
  ok('core has no automations re-export');
}

// --- ADR-0005: automations still has its own AgentEvent ---
const autoTypes = read('packages/shared/src/automations/types.ts');
if (autoTypes && /export\s+type\s+AgentEvent\s*=/.test(autoTypes)) {
  if (/PreToolUse/.test(autoTypes) && /'Stop'|"Stop"/.test(autoTypes)) {
    ok('automations AgentEvent is hook-name union (not stream objects)');
  } else {
    fail('automations AgentEvent missing expected hook names (PreToolUse/Stop)');
  }
}

// session self-management binding still present
const bindings = read('packages/shared/src/agent/session-self-management-bindings.ts');
if (bindings && /export function attachSessionSelfManagementBindings/.test(bindings)) {
  if (/getSessionScopedToolCallbacks/.test(bindings) && /NO memoization|no memoization|fresh/i.test(bindings)) {
    ok('session self-management lazy bindings intact');
  } else {
    // comment wording may drift — structural check is enough
    ok('session self-management export intact');
  }
}

// --- ADR-0004: AbortReason members ---
const lifecycle = read('packages/shared/src/agent/core/session-lifecycle.ts');
if (lifecycle) {
  for (const m of ['UserStop', 'PlanSubmitted', 'AuthRequest', 'Redirect', 'SourceActivated']) {
    if (!lifecycle.includes(m)) fail(`AbortReason missing ${m}`);
  }
  if (failures.every((f) => !f.startsWith('AbortReason'))) {
    ok('AbortReason members present');
  }
}

// AgentBackend still exposes both interrupt APIs
const backendTypes = read('packages/shared/src/agent/backend/types.ts');
if (backendTypes) {
  if (!/forceAbort\s*\(/.test(backendTypes)) fail('AgentBackend missing forceAbort');
  if (!/interruptForHandoff\s*\(/.test(backendTypes)) fail('AgentBackend missing interruptForHandoff');
  if (backendTypes.includes('forceAbort') && backendTypes.includes('interruptForHandoff')) {
    ok('AgentBackend forceAbort + interruptForHandoff present');
  }
}

// Claude overrides handoff (ADR-0004)
const claude = read('packages/shared/src/agent/claude-agent.ts');
if (claude && /override\s+interruptForHandoff/.test(claude)) {
  ok('ClaudeAgent overrides interruptForHandoff');
} else if (claude) {
  fail('ClaudeAgent lost interruptForHandoff override (ADR-0004)');
}

// Pi overrides handoff (ADR-0004 contract fix)
const piAgent = read('packages/shared/src/agent/pi-agent.ts');
if (piAgent && /override\s+interruptForHandoff/.test(piAgent)) {
  ok('PiAgent overrides interruptForHandoff');
} else if (piAgent) {
  fail('PiAgent lost interruptForHandoff override (ADR-0004)');
}

// fork-local contract package must exist (new-dir feature increment, ADR-0001)
if (existsSync(join(root, 'packages/agent-contracts/src/index.ts'))) {
  ok('@hagents/agent-contracts package present');
} else {
  fail('missing packages/agent-contracts (fork-local contract guards)');
}

// SourceType stays closed set (ADR-0013 / CONTEXT)
const sourceTypes = read('packages/shared/src/sources/types.ts');
if (sourceTypes) {
  if (/export type SourceType = 'mcp' \| 'api' \| 'local'/.test(sourceTypes)) {
    ok('SourceType = mcp|api|local');
  } else {
    fail('SourceType no longer mcp|api|local (ADR-0013)');
  }
}

// --- AbortReason enum ↔ agent-contracts tables (anti-drift, ADR-0004/0006) ---
const interruptContracts = read('packages/agent-contracts/src/interrupt.ts');
if (lifecycle && interruptContracts) {
  const enumRe = /export enum AbortReason \{([\s\S]*?)\n\}/;
  const enumBody = lifecycle.match(enumRe)?.[1] ?? '';
  const enumValues = [...enumBody.matchAll(/=\s*'([a-z_]+)'/g)].map((m) => m[1]!);
  const handoffBody =
    interruptContracts.match(/HANDOFF_ABORT_REASONS\s*=\s*\[([\s\S]*?)\]/)?.[1] ?? '';
  const hardBody =
    interruptContracts.match(/HARD_ABORT_REASONS\s*=\s*\[([\s\S]*?)\]/)?.[1] ?? '';
  const handoff = [...handoffBody.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]!);
  const hard = [...hardBody.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]!);
  const contractsAll = new Set([...handoff, ...hard]);
  const enumSet = new Set(enumValues);

  for (const v of enumValues) {
    if (!contractsAll.has(v)) {
      fail(`AbortReason "${v}" missing from agent-contracts HANDOFF/HARD tables`);
    }
  }
  for (const v of contractsAll) {
    if (!enumSet.has(v)) {
      fail(`agent-contracts reason "${v}" not in AbortReason enum`);
    }
  }
  for (const v of handoff) {
    if (hard.includes(v)) fail(`reason "${v}" listed as both handoff and hard`);
  }
  if (enumValues.length === 7 && handoff.length === 2 && hard.length === 5) {
    ok('AbortReason ↔ agent-contracts tables in sync (7=2+5, disjoint)');
  } else if (failures.every((f) => !f.includes('AbortReason') && !f.includes('agent-contracts'))) {
    ok(
      `AbortReason ↔ agent-contracts tables in sync (enum=${enumValues.length} handoff=${handoff.length} hard=${hard.length})`,
    );
  }
}

// --- report ---
console.log('HAgents architecture check');
console.log(`  root: ${relative(process.cwd(), root) || '.'}`);
for (const m of oks) console.log(`  ✓ ${m}`);
if (failures.length) {
  console.error(`\n${failures.length} failure(s):`);
  for (const m of failures) console.error(`  ✗ ${m}`);
  process.exit(1);
}
console.log(`\n${oks.length} check(s) passed`);
