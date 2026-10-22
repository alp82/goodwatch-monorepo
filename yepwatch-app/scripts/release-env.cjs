const { spawnSync } = require('node:child_process');
const env = { ...process.env, APP_VARIANT: process.env.APP_VARIANT ?? 'production', APP_BUILD_NUMBER: process.env.APP_BUILD_NUMBER ?? '4',
  EXPO_NO_DOTENV: '1', EXPO_PUBLIC_API_ORIGIN: 'https://yepwatch.com', EXPO_PUBLIC_APP_ORIGIN: 'https://yepwatch.com',
  EXPO_PUBLIC_WS_ORIGIN: 'wss://yepwatch.com', EXPO_PUBLIC_ENABLE_FIXTURES: 'false', EXPO_PUBLIC_GUEST_ONLY: process.env.EXPO_PUBLIC_GUEST_ONLY ?? 'false' };
delete env.EXPO_PUBLIC_DEVELOPMENT_NOTICE;
const result = spawnSync(process.execPath, [require.resolve('expo/bin/cli'), ...process.argv.slice(2)], { env, stdio: 'inherit' });
process.exit(result.status ?? 1);
