import test from 'node:test'
import assert from 'node:assert/strict'
import { runtimeConfig } from '../src/runtime-config.js'

test('Development stays loopback-only; container release requires explicit proposal bind and exact HTTPS origin', () => {
  assert.deepEqual(runtimeConfig({}), { host: '127.0.0.1', container: false })
  assert.throws(() => runtimeConfig({ YEPWATCH_REALTIME_HOST: '0.0.0.0' }), /loopback/)
  const release = { YEPWATCH_DEPLOYMENT: 'container', YEPWATCH_PROPOSAL: '1', YEPWATCH_REALTIME_HOST: '0.0.0.0', YEPWATCH_ALLOWED_ORIGINS: 'https://yepwatch.com' }
  assert.deepEqual(runtimeConfig(release), { host: '0.0.0.0', container: true })
  for (const change of [{ YEPWATCH_PROPOSAL: '0' }, { YEPWATCH_CONTINUOUS: '1' }, { YEPWATCH_REALTIME_HOST: '127.0.0.1' },
    { YEPWATCH_ALLOWED_ORIGINS: '' }, { YEPWATCH_ALLOWED_ORIGINS: 'http://yepwatch.com' },
    { YEPWATCH_ALLOWED_ORIGINS: 'https://yepwatch.com/path' }, { YEPWATCH_ALLOWED_ORIGINS: 'https://yepwatch.com,https://other.test' }])
    assert.throws(() => runtimeConfig({ ...release, ...change }))
})
