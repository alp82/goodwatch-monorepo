import test from 'node:test'
import assert from 'node:assert/strict'
import { Simulator, localOrigin } from '../simulator/engine.js'

test('Simulator refuses production, credential, path and non-loopback origins before any connection', () => {
  for (const origin of ['https://yepwatch.com', 'http://192.168.1.1:3000', 'http://127.0.0.1:3000/path',
    'http://secret@127.0.0.1:3000', 'http://127.0.0.1:3000?token=x', 'http://localhost:3000']) {
    assert.throws(() => localOrigin(origin, 'http:'))
  }
  assert.equal(localOrigin('http://127.0.0.1:15995', 'http:'), 'http://127.0.0.1:15995')
  assert.throws(() => new Simulator({ apiOrigin: 'https://yepwatch.com', wsOrigin: 'ws://127.0.0.1:4319', appOrigin: 'http://127.0.0.1:8101' }))
})
test('Simulator only accepts controlled fresh-demo actor IDs and bounded choices', async t => {
  const sim = new Simulator({ apiOrigin: 'http://127.0.0.1:15995', wsOrigin: 'ws://127.0.0.1:4319', appOrigin: 'http://127.0.0.1:8101' })
  t.after(() => sim.close())
  await assert.rejects(sim.action('some-retained-room-or-actor', 'watch'), /fresh demo/)
  await assert.rejects(sim.fresh({ count: 4, scenario: 'agreement', paceMs: 1500 }), /one to three/)
  await assert.rejects(sim.controls({ paceMs: 1 }), /Pace/)
  assert.equal(sim.state().room, false)
})
