import { readFileSync } from 'node:fs'

function secret(name) {
  const path = process.env[`${name}_FILE`]
  if (!path || process.env[name]) throw new Error(`Provide only ${name}_FILE`)
  const value = readFileSync(path, 'utf8').trim()
  if (value.length < 32) throw new Error(`Invalid ${name} file`)
  process.env[name] = value
}
secret('YEPWATCH_GATEWAY_SECRET')
secret('YEPWATCH_VALKEY_PASSWORD')
await import('../dist/main.js')
