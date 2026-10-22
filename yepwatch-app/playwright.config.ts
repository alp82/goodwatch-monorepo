import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/glow-browser',
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['json', { outputFile: 'artifacts/browser-results.json' }]],
  use: {
    baseURL: 'http://127.0.0.1:8097',
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
  },
  webServer: {
    command:
      'EXPO_PUBLIC_ENABLE_FIXTURES=true npx expo export --platform web --source-maps --output-dir dist-test --clear && EXPORT_DIR=dist-test PORT=8097 node scripts/serve.cjs',
    url: 'http://127.0.0.1:8097',
    reuseExistingServer: false,
    timeout: 120000,
  },
  outputDir: 'artifacts/browser-traces',
});
