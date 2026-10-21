import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { once } from 'node:events'
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

test('Two controller instances keep independent authorization in one cookie jar across root, actions and SSE', { timeout: 20_000 }, async t => {
  let upstreamRequests = 0
  const upstream = createServer((_request, response) => { upstreamRequests++; response.writeHead(500).end() })
  await new Promise<void>(resolve => upstream.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise<void>(resolve => upstream.close(() => resolve())))
  const upstreamAddress = upstream.address(); assert(upstreamAddress && typeof upstreamAddress !== 'string')
  const unusedPort = async () => {
    const server = createServer()
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const address = server.address(); assert(address && typeof address !== 'string')
    await new Promise<void>(resolve => server.close(() => resolve()))
    return address.port
  }
  const ports = [await unusedPort()]
  do { ports[1] = await unusedPort() } while (ports[1] === ports[0])
  const origins = ports.map(port => `http://127.0.0.1:${port}`)
  for (const port of ports) {
    const child = spawn(process.execPath, ['--import', 'tsx', 'simulator/server.ts'], {
      cwd: new URL('..', import.meta.url), stdio: ['ignore', 'pipe', 'pipe'],
      env: { PATH: process.env.PATH, YEPWATCH_SIM_PORT: String(port),
        YEPWATCH_SIM_API_ORIGIN: `http://127.0.0.1:${upstreamAddress.port}`,
        YEPWATCH_SIM_WS_ORIGIN: `ws://127.0.0.1:${upstreamAddress.port}`,
        YEPWATCH_SIM_APP_ORIGIN: `http://127.0.0.1:${upstreamAddress.port}` },
    })
    t.after(async () => {
      if (child.exitCode === null && child.signalCode === null) { const closed = once(child, 'close'); child.kill('SIGTERM'); await closed }
    })
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Disposable simulator startup timed out')), 5000)
      child.once('error', error => { clearTimeout(timer); reject(error) })
      child.once('exit', () => { clearTimeout(timer); reject(new Error('Disposable simulator exited')) })
      child.stderr.resume()
      child.stdout.on('data', chunk => { if (chunk.toString().includes('YepWatch local simulator:')) { clearTimeout(timer); resolve() } })
    })
  }
  // Cookies are shared by hostname/path across ports, just as in one browser profile.
  // Preserve a legacy 8120 cookie without contacting that retained process.
  const jar = new Map([['yepwatch_sim_control', 'preserved-legacy-control-token']])
  const cookie = () => [...jar].map(([name, value]) => `${name}=${value}`).join('; ')
  const root = async (origin: string) => {
    const response = await fetch(origin, { headers: { Cookie: cookie() }, signal: AbortSignal.timeout(3000) })
    assert.equal(response.status, 200)
    const set = response.headers.getSetCookie(); assert.equal(set.length, 1)
    assert.match(set[0], /; Path=\/simulator\/; HttpOnly; SameSite=Strict$/)
    const pair = set[0].split(';')[0], delimiter = pair.indexOf('=')
    jar.set(pair.slice(0, delimiter), pair.slice(delimiter + 1))
    await response.text()
  }
  const controls = async (origin: string, paceMs: number) => {
    const response = await fetch(`${origin}/simulator/controls`, { method: 'POST',
      headers: { Cookie: cookie(), Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ automatic: false, paceMs }), signal: AbortSignal.timeout(3000) })
    assert.equal(response.status, 200, 'Other controller root must not invalidate this controller')
    assert.deepEqual(await response.json(), { ok: true })
  }
  const subscribe = async (origin: string) => {
    const response = await fetch(`${origin}/simulator/events`, { headers: { Cookie: cookie(), Origin: origin }, signal: AbortSignal.timeout(5000) })
    assert.equal(response.status, 200)
    assert.match(response.headers.get('content-type') ?? '', /text\/event-stream/)
    assert(response.body)
    const reader = response.body.getReader()
    let buffer = ''
    return { close: () => reader.cancel(), next: async () => {
      while (!buffer.includes('\n\n')) { const chunk = await reader.read(); assert(!chunk.done); buffer += Buffer.from(chunk.value).toString() }
      const boundary = buffer.indexOf('\n\n'), frame = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2)
      return JSON.parse(frame.slice('data: '.length))
    } }
  }
  for (let round = 0; round < 3; round++) {
    for (const origin of round % 2 ? [...origins].reverse() : origins) await root(origin)
    // This fails with the original generic cookie: the second root overwrites the first token.
    await controls(origins[0], 700 + round)
    await controls(origins[1], 900 + round)
    const streams = await Promise.all(origins.map(subscribe))
    try {
      for (const stream of streams) { const state = await stream.next(); assert.equal(state.room, false); assert.deepEqual(state.actors, []) }
      for (let index = 0; index < streams.length; index++) {
        const pace = 1100 + index * 100 + round
        await controls(origins[index], pace)
        assert.equal((await streams[index].next()).paceMs, pace)
      }
    } finally { await Promise.all(streams.map(stream => stream.close())) }
  }
  assert.equal(jar.get('yepwatch_sim_control'), 'preserved-legacy-control-token')
  assert.deepEqual([...jar.keys()].sort(), ['yepwatch_sim_control', ...ports.map(port => `yepwatch_sim_control_${port}`)].sort())
  for (let index = 0; index < origins.length; index++) {
    for (const credential of ['yepwatch_sim_control=preserved-legacy-control-token',
      `yepwatch_sim_control_${ports[index]}=${jar.get(`yepwatch_sim_control_${ports[1 - index]}`)}`]) {
      const response = await fetch(`${origins[index]}/simulator/events`, { headers: { Cookie: credential }, signal: AbortSignal.timeout(3000) })
      assert.equal(response.status, 403)
      await response.text()
    }
  }
  assert.equal(upstreamRequests, 0, 'No API, WS or room mutation is needed to prove cookie isolation')
})
