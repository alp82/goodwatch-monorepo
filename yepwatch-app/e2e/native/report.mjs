#!/usr/bin/env node
// Prints a run's findings grouped by gate.  node e2e/native/report.mjs [.cache/runs/<run>/result.json]
import fs from 'node:fs';
import path from 'node:path';
import { RUNS_DIR } from './lib/env.mjs';

const file = process.argv[2] ?? path.join(RUNS_DIR, fs.readdirSync(RUNS_DIR).sort().pop(), 'result.json');
const r = JSON.parse(fs.readFileSync(file, 'utf8'));
const g = r.gates;
console.log(`${r.mode} ${r.pass ? 'PASS' : 'FAIL'} ${(r.wallMs / 1000).toFixed(0)} s, phases ${JSON.stringify(r.phases)}, stack ${r.stack?.source}`);
console.log('\nScenarios'); for (const s of r.scenarios) console.log(`  ${s.pass ? 'ok  ' : 'FAIL'} ${s.name} ${s.ms} ms${s.error ? ` - ${s.error}` : ''}`);
console.log('\nTiming (ms vs target, reported only; first visible change / settled)');
for (const t of r.speed ?? []) console.log(`  ${t.onTarget ? 'ok  ' : t.ms === undefined ? 'n/a ' : 'over'} ${t.name}: ${t.ms ?? '-'} / ${t.budgetMs}  (first ${t.firstMs ?? '-'}, settled ${t.settledMs ?? '-'}, max frame gap ${t.maxGapMs ?? '-'})${t.error ? ' ' + t.error : ''}`);
console.log('\nFlash'); for (const f of g.flash) console.log(`  ${f.name}: blank ${f.blankFrames}, spikes ${f.spikes.length}, intermediate ${f.intermediate.map(p => `${p.ms}ms`).join(' ')} -> ${f.frames}`);
console.log('\nJourney'); for (const j of g.journey) console.log(`  ${j.name}: ${j.detail}`);
console.log('\nStuck'); for (const s of g.stuck) console.log(`  ${s.phone} ${s.where}: ${s.words.join(' | ')}`);
console.log('\nFrames'); for (const f of g.frames) console.log(`  ${f.pass ? 'ok  ' : 'FAIL'} ${f.name}: ${f.over20}/${f.count} frames > ${f.budgetMs} ms, max ${f.max}, p95 ${f.p95}`);
console.log('\nErrors'); for (const e of g.errors) console.log(`  ${e.phone} ${e.kind} [${e.scenario}] ${e.line}`);
console.log('\nAccessibility (unique)');
const u = new Map();
for (const f of g.a11y) { const k = `${f.rule} ${f.element.replace(/ [\d,]+$/, '')}${f.dp ? ` ${f.dp}dp` : ''}`; u.set(k, [...new Set([...(u.get(k) ?? []), f.screen])]); }
for (const [k, v] of u) console.log(`  ${k} — ${v.join(', ')}`);
