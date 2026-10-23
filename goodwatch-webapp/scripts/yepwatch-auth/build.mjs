import { build } from 'esbuild'
await build({ entryPoints:['scripts/yepwatch-auth/client.ts'], outfile:'build/yepwatch-auth-client.mjs', bundle:true, packages:'external', platform:'node',target:'node24',format:'esm', banner:{js:'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);'} })
console.log('Built build/yepwatch-auth-client.mjs; run beside GoodWatch runtime dependencies with the existing issuer environment.')
