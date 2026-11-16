import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

test('suspension moves wall time and Date construction while leaving frame, timer and performance clocks intact', () => {
  const source = ts.transpileModule(readFileSync(new URL('../e2e/lib/wall-clock.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const context = { exports: {}, window: {}, performance: { now: () => 123 }, requestAnimationFrame: () => 1, setTimeout };
  const result = runInNewContext(`
    const frame = requestAnimationFrame, timer = setTimeout, perf = performance.now;
    ${source}
    exports.installWallClockOffset();
    const before = Date.now();
    window.__ywAdvanceWallClock(300000);
    ({ elapsed: Date.now() - before, constructed: new Date().getTime() - before,
      fixed: new Date(42).getTime(), parsed: Date.parse('1970-01-01T00:00:00.000Z'),
      dateString: Date(), expectedString: new Date().toString(),
      sameFrame: frame === requestAnimationFrame, sameTimer: timer === setTimeout, samePerformance: perf === performance.now })
  `, context);
  assert.ok(result.elapsed >= 300000 && result.elapsed < 300050);
  assert.ok(result.constructed >= 300000 && result.constructed < 300050);
  assert.equal(result.fixed, 42); assert.equal(result.parsed, 0);
  assert.equal(result.dateString, result.expectedString);
  assert.equal(result.sameFrame, true); assert.equal(result.sameTimer, true); assert.equal(result.samePerformance, true);
});
