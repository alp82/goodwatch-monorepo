import test from 'node:test';
import assert from 'node:assert/strict';
import { webReuseProblem } from '../e2e/ci/ota-cache.mjs';
const receipt = { commit: 'a'.repeat(40), pass: false, runs: { 'web-full': { pass: true, exit: 0, ms: 1000 } } };

test('a passed full web stage remains valid after native-only runner fixes, even when Android failed', () => {
  assert.equal(webReuseProblem(receipt, ['yepwatch-app/e2e/native/lib/phone.mjs', 'yepwatch-app/e2e/native/run.mjs', 'yepwatch-app/tests/native-display.test.ts']), null);
});

test('application, web runner, backend and configuration changes require a new full web run', () => {
  for (const file of ['yepwatch-app/src/features/shell/Header.tsx', 'yepwatch-app/e2e/lib/harness.ts', 'yepwatch-app/e2e/web/voting.spec.ts', 'yepwatch-app/e2e/run.mjs', 'yepwatch-app/eas.json', 'yepwatch-app/package-lock.json', 'goodwatch-webapp/app/server/yepwatch/proposal.ts', 'yepwatch-realtime/src/index.ts', 'unknown.txt'])
    assert.match(webReuseProblem(receipt, [file]) ?? '', /web inputs changed/, file);
});

test('a missing, failed or inconsistent receipt never supplies a passing web stage', () => {
  assert.ok(webReuseProblem(null, []));
  assert.ok(webReuseProblem({ ...receipt, runs: { 'web-full': { pass: false, exit: 0, ms: 1000 } } }, []));
  assert.ok(webReuseProblem({ ...receipt, runs: { 'web-full': { pass: true, exit: 1, ms: 1000 } } }, []));
  assert.ok(webReuseProblem({ ...receipt, commit: '--option' }, []));
});

test('reuse retains the original tested source across a chain of native runner fixes', () => {
  const v = { ...receipt, commit: 'b'.repeat(40), runs: { 'web-full': { ...receipt.runs['web-full'], sourceCommit: 'a'.repeat(40) } } };
  assert.equal(webReuseProblem(v, ['yepwatch-app/e2e/ci/ota-gate.mjs', 'yepwatch-app/e2e/ci/ota-cache.mjs', '.github/workflows/yepwatch-gate.yml']), null);
});
