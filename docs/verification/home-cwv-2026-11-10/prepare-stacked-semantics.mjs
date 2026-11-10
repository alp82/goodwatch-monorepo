// Prepare the offline native-browser check from the current production CSS pipeline and real scoring SSR fixture.
// Run from any directory with Node24+, then mount the output as /data for stacked-semantics.mjs.
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { compiledStackedCSS, currentStackedVariant, ORIGINAL_STACKED_VARIANT, stackedCandidates, PACKAGE_ROOT }
  from '../../../goodwatch-webapp/app/ui/scoring/stacked-css.test-support.ts';
const rendered = JSON.parse(execFileSync('node_modules/.bin/vite-node', [
  '--config', 'app/ui/imports/source-import-test-vite.config.ts', 'app/ui/scoring/score-control.test-support.tsx',
], { cwd: PACKAGE_ROOT, encoding: 'utf8', env: { ...process.env, CHOKIDAR_USEPOLLING: 'true' },
  stdio: ['ignore', 'pipe', 'pipe'] }).split('__SCORE_CONTROL__').at(-1));
const markup = { status: rendered.status, seen: rendered.faces[0] };
const classes = [...new Set(['@container/seen', ...stackedCandidates(), ...Object.values(markup)
  .flatMap(html => [...html.matchAll(/class="([^"]+)"/g)].flatMap(match => match[1].split(/\s+/)))])];
const css = { reference: await compiledStackedCSS(ORIGINAL_STACKED_VARIANT, classes),
  candidate: await compiledStackedCSS(currentStackedVariant(), classes) };
const output = process.argv[2] || resolve(PACKAGE_ROOT,
  '../goodwatch-benchmark/results/home-cwv-2026-11-10/implementation-checks/stacked-semantics');
await mkdir(output, { recursive: true });
await writeFile(resolve(output, 'input.json'), JSON.stringify({ css, markup,
  source: 'current app/tailwind.css stacked variant versus original matching contract',
  productionMinifiers: '@tailwindcss/node 4.1.5 optimize(minify:true) and esbuild CSS minify with Vite modules targets' }));
console.log(output);
