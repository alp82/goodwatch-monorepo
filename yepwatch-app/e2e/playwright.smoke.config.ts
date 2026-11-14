import { defineConfig } from '@playwright/test';

// e2e:smoke — against the local stack or a real origin (E2E_ORIGIN with E2E_TARGET=production). No speed
// checks (README). No retries.
export default defineConfig({
  testDir: './smoke',
  outputDir: process.env.E2E_OUT ?? './artifacts/smoke-results',
  retries: 0,
  fullyParallel: true,
  workers: Number(process.env.E2E_WORKERS ?? 4),
  timeout: 60000,
  reporter: [[process.env.CI ? 'dot' : 'list'], ['./lib/reporter.ts']],
  use: { actionTimeout: 15000 },
  projects: [{ name: 'smoke', use: { fault: 'none' } }],
});
