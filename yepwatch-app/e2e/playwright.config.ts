import { defineConfig } from '@playwright/test';

// Projects are fault conditions: every journey runs under each selected one (e2e/run.mjs picks them per tier).
// No retries anywhere: a flaky pass is a failure.
//   E2E_FAULT_GREP   only tests whose title matches run under the fault projects (gate tier: @core)
const faults = ['none', 'nows', 'rapid', 'slow', 'hidden', 'twodevice', 'restart'] as const;
const faultGrep = process.env.E2E_FAULT_GREP ? new RegExp(process.env.E2E_FAULT_GREP) : undefined;
export default defineConfig({
  testDir: './web',
  outputDir: process.env.E2E_OUT ?? './artifacts/results',
  retries: 0,
  fullyParallel: true,
  workers: Number(process.env.E2E_WORKERS ?? 8),
  timeout: Number(process.env.E2E_TEST_TIMEOUT ?? 120000),
  expect: { timeout: 10000 },
  reporter: [[process.env.CI ? 'dot' : 'list'], ['./lib/reporter.ts']],
  use: { trace: 'off', video: 'off', actionTimeout: 15000 },
  projects: faults.map((fault) => ({
    name: fault,
    use: { fault },
    // Timing moments are measured on the clean stack only.
    ...(fault === 'none' ? {} : { testIgnore: /timing\.spec\.ts/, ...(faultGrep ? { grep: faultGrep } : {}) }),
    // A stack-wide restart disturbs every room on the stack: one test at a time.
    ...(fault === 'restart' ? { workers: 1 } : {}),
  })),
});
