// Synchronize only the public release values already tracked in eas.json.
// EAS Update does not inherit a build profile's env; it reads its named environment.
const { spawnSync } = require('node:child_process');
const { build } = require('../eas.json');
for (const [environment, variant] of [['production', 'production'], ['preview', 'preview']]) {
  const env = { ...build.base.env, APP_VARIANT: variant, EXPO_NO_DOTENV: '1' };
  for (const [name, value] of Object.entries(env)) {
    if (!['APP_VARIANT', 'APP_BUILD_NUMBER', 'EXPO_NO_DOTENV'].includes(name) && !name.startsWith('EXPO_PUBLIC_')) continue;
    const result = spawnSync('npx', ['eas-cli@latest', 'env:set', environment, '--name', name, '--value', value, '--visibility', 'plaintext', '--non-interactive'], { stdio: 'inherit' });
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
}
