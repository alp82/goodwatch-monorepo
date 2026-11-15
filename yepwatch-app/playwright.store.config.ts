import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/glow-browser', workers: 1, fullyParallel: false, reporter: 'list',
  // The first-round how-to plays once per browser: store shots start with it seen.
  use: { baseURL: 'http://127.0.0.1:8159', viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', trace: 'retain-on-failure', storageState: { cookies: [], origins: [{ origin: 'http://127.0.0.1:8159', localStorage: [{ name: 'yepwatch.v3.tonight-howto-seen', value: '1' }] }] } },
  webServer: {
    command: 'EXPO_NO_DOTENV=1 EXPO_PUBLIC_ENABLE_FIXTURES=true npx expo export --platform web --output-dir .expo/exports/store-web --clear && EXPORT_DIR=.expo/exports/store-web PORT=8159 node scripts/serve.cjs',
    url: 'http://127.0.0.1:8159', reuseExistingServer: false, timeout: 120000,
  },
  outputDir: '.expo/store-browser-traces',
});
