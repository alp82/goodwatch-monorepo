// #534 safety harness: never load production service values, even if a .env appears in this worktree.
import { readFileSync, existsSync } from 'node:fs'
import { spawn } from 'node:child_process'
const build = process.argv.includes("--build")
const env = { ...process.env }
for (const file of ['.env', '.env.local', '.env.development', '.env.development.local']) {
  if (!existsSync(file)) continue
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/)
    if (match) env[match[1]] = ''
  }
}
for (const key of Object.keys(env)) if (/^(CRATE|REDIS|VALKEY|QDRANT|SUPABASE|SENTRY|POSTHOG|VITE_|SMTP|PURELYMAIL|TITLE_SNAPSHOT|APP_ORIGIN|STATIC_ASSET)/.test(key)) env[key] = ''
Object.assign(env, { NODE_ENV: build ? 'production' : 'development', SUPABASE_URL: 'http://127.0.0.1:9', SUPABASE_ANON_KEY: 'prototype-no-service', APP_ORIGIN: '', REC_NAVIGATION: 'on', METRICS_PORT: '0' })
const child = spawn('node', ['node_modules/@remix-run/dev/dist/cli.js', ...(build ? ['vite:build'] : ['vite:dev', '--host', '127.0.0.1', '--port', '3114', '--strictPort'])], { env, stdio: 'inherit' })
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal))
child.on('exit', code => process.exit(code ?? 0))
