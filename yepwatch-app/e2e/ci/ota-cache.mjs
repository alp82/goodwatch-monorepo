// Reuse a successful full web run only when every changed file is outside that run's inputs.
const NATIVE_ONLY = /^yepwatch-app\/e2e\/native\//;
const RELEASE_DRIVER = /^yepwatch-app\/e2e\/ci\/(ota-gate|ota-cache)\.mjs$/;
const UNIT_ONLY = /^yepwatch-app\/tests\/(ota-cache|native-[^/]+)\.test\.ts$/;
export function webReuseProblem(verdict, changed) {
  const source = verdict?.runs?.['web-full']?.sourceCommit ?? verdict?.commit;
  if (!/^[0-9a-f]{40}$/.test(source ?? '')) return 'the receipt has no valid source commit';
  const web = verdict?.runs?.['web-full'];
  if (web?.pass !== true || web.exit !== 0 || !(web.ms > 0)) return 'the recorded full web run did not pass';
  const affected = changed.filter(p => !(NATIVE_ONLY.test(p) || RELEASE_DRIVER.test(p) || UNIT_ONLY.test(p) || p === '.github/workflows/yepwatch-gate.yml'));
  return affected.length ? `web inputs changed: ${affected.join(', ')}` : null;
}
