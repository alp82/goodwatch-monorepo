import test from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { paths, type RoomSnapshot, type RoomCommand, type ServerRealtimeFrame } from '@goodwatch/yepwatch-contracts/continuous'
import { ContinuousSimulator } from '../simulator-continuous/engine.js'
import { connect, until } from './client.js'
const nonce = () => randomBytes(32).toString('base64url')

test('Continuous simulator refuses remote authority and uncontrolled identities without making requests', async t => {
  assert.throws(() => new ContinuousSimulator({ apiOrigin: 'https://yepwatch.com', wsOrigin: 'ws://127.0.0.1:4321', appOrigin: 'http://127.0.0.1:8131' }))
  assert.throws(() => new ContinuousSimulator({ apiOrigin: 'http://127.0.0.1:15994', wsOrigin: 'ws://127.0.0.1:4321', appOrigin: 'http://127.0.0.1:8131', serviceId: -1 }))
  const sim = new ContinuousSimulator({ apiOrigin: 'http://127.0.0.1:15994', wsOrigin: 'ws://127.0.0.1:4321', appOrigin: 'http://127.0.0.1:8131' })
  t.after(() => sim.close())
  await assert.rejects(sim.action('host-or-arbitrary-person', 'watch'), /artificial guests/)
  await assert.rejects(sim.fresh({ count: 4, scenario: 'agreement', paceMs: 700 }), /one to three/)
  await assert.rejects(sim.controls({ paceMs: 1 }), /Pace/)
  assert.equal(sim.state().room, false)
})

test('Opt-in actual continuous API simulator: independent cards, exact lost-ack repair, latejoin/pick invalidation, disconnect quorum and automatic Done', {
  skip: process.env.YEPWATCH_TEST_CONTINUOUS_LIVE !== '1', timeout: 25_000,
}, async t => {
  const origin = 'http://127.0.0.1:15994', appOrigin = 'http://127.0.0.1:8131', wsOrigin = 'ws://127.0.0.1:4321'
  const sim = new ContinuousSimulator({ apiOrigin: origin, wsOrigin, appOrigin }); t.after(() => sim.close())
  const fresh = await sim.fresh({ count: 2, scenario: 'agreement', paceMs: 700 })
  assert(fresh.cookie.includes('HttpOnly')); assert.equal(sim.state().actors.length, 3)
  const host = sim.state().actors.find(a => a.host)!; await assert.rejects(sim.action(host.id, 'watch'), /artificial guests/)
  const id = sim.state().shared!.roomId, bots = sim.state().actors.filter(a => !a.host)
  const headers = { Cookie: fresh.cookie.split(';')[0], Origin: appOrigin, 'Content-Type': 'application/json' }
  async function request<T>(path: string, body?: unknown) {
    const response = await fetch(new URL(path, origin), { method: body === undefined ? 'GET' : 'POST', headers, body: body === undefined ? undefined : JSON.stringify(body) })
    assert.equal(response.status, 200); return await response.json() as T
  }
  const read = () => request<RoomSnapshot>(paths.snapshot(id))
  async function command(input: (s: RoomSnapshot) => RoomCommand) {
    const state = await read()
    return request<{ snapshot: RoomSnapshot }>(paths.commands(id), { commandId: nonce(), sequence: state.own.nextSequence, command: input(state) })
  }
  const ticket = await request<{ ticket: string }>(paths.realtimeTicket(id), {})
  const observer = await connect<ServerRealtimeFrame>(`${wsOrigin}${paths.realtime}`, ticket.ticket, { origin: appOrigin }, id)
  t.after(() => observer.ws.close())
  await command(s => ({ type: 'start', expectedContextVersion: s.shared.contextVersion, expectedRosterVersion: s.shared.rosterVersion, hostReady: true }))
  await until(() => sim.state().actors.filter(a => !a.host).every(a => a.privateCard && a.privateCaughtUp), 5000)
  assert.notEqual(sim.state().actors.find(a => a.id === bots[0].id)!.privateCard!.id, sim.state().actors.find(a => a.id === bots[1].id)!.privateCard!.id)
  const originalFetch = globalThis.fetch, envelopes: string[] = []
  let lose = true
  globalThis.fetch = async (input, init) => {
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : null
    if (body?.command?.type === 'vote' && new Headers(init?.headers).get('X-YepWatch-Client') === 'native') {
      envelopes.push(init!.body as string)
      const response = await originalFetch(input, init)
      if (lose) { lose = false; await response.text(); throw new Error('Injected lost response') }
      return response
    }
    return originalFetch(input, init)
  }
  try { await assert.rejects(sim.action(bots[0].id, 'watch'), /outcome_unknown/); await sim.action(bots[0].id, 'retry') }
  finally { globalThis.fetch = originalFetch }
  assert.equal(envelopes.length, 2); assert.equal(envelopes[0], envelopes[1]); assert(!sim.state().actors.find(a => a.id === bots[0].id)!.pending)
  assert.equal(sim.state().actors.find(a => a.id === bots[0].id)!.privateAnswered, 1)
  // Host votes intentionally; bot private order remains independent.
  for (const candidate of (await read()).shared.candidates) await command(s => ({ type: 'vote', generation: s.shared.generation, candidateId: candidate.id,
    expectedVoteRevision: s.own.votes.find(v => v.candidateId === candidate.id)?.revision ?? 0, value: 'watch' }))
  for (let step = 0; step < 4 && !sim.state().shared!.matches.length; step++) for (const bot of bots) await sim.action(bot.id, 'step')
  const matched = sim.state().shared!.matches[0]?.candidateId; assert(matched)
  await command(s => ({ type: 'pick', generation: s.shared.generation, expectedRosterVersion: s.shared.rosterVersion, candidateId: matched, expectedPickRevision: s.own.pick.revision }))
  await sim.addGuest()
  assert.equal(sim.state().shared!.participants.length, 4); assert.equal(sim.state().shared!.matches.length, 0)
  assert.equal((await read()).own.pick.candidateId, null)
  const late = sim.state().actors.filter(a => !a.host).at(-1)!
  await sim.action(late.id, 'disconnect'); assert.equal((await read()).shared.participants.length, 4)
  await sim.action(late.id, 'reconnect')
  for (let step = 0; step < 12 && !(await read()).shared.matches.length; step++) {
    for (const bot of sim.state().actors.filter(a => !a.host)) await sim.action(bot.id, 'watch')
  }
  const target = (await read()).shared.matches[0]?.candidateId; assert(target)
  for (const bot of sim.state().actors.filter(a => !a.host)) await sim.action(bot.id, 'pick', { candidateId: target })
  const done = await command(s => ({ type: 'pick', generation: s.shared.generation, expectedRosterVersion: s.shared.rosterVersion, candidateId: target, expectedPickRevision: s.own.pick.revision }))
  assert.equal(done.snapshot.shared.phase, 'decided')
  await until(() => observer.frames.some(f => f.type === 'activity'), 3000)
  for (const frame of observer.frames) if (frame.type === 'activity') for (const forbidden of ['candidateId', 'title', 'value', 'direction', 'pick', 'x', 'y']) assert(!(forbidden in frame))
  assert.equal(sim.state().privacyFailures, 0)
})

test('Opt-in actual API admission fencing: held latejoin blocks replacement; stopping discards delayed actor without changing quorum', {
  skip: process.env.YEPWATCH_TEST_CONTINUOUS_LIVE !== '1', timeout: 20_000,
}, async t => {
  const sim = new ContinuousSimulator({ apiOrigin: 'http://127.0.0.1:15994', wsOrigin: 'ws://127.0.0.1:4321', appOrigin: 'http://127.0.0.1:8131' })
  t.after(() => sim.close())
  const fresh = await sim.fresh({ count: 1, scenario: 'agreement', paceMs: 700 })
  const roomId = sim.state().shared!.roomId, originalFetch = globalThis.fetch
  let release: (() => void) | undefined, held = false, replacementCreates = 0
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input))
    if (url.pathname === paths.rooms && init?.method === 'POST') replacementCreates++
    const response = await originalFetch(input, init)
    if (url.pathname === paths.join(roomId) && init?.method === 'POST' && response.ok) {
      held = true
      await new Promise<void>(resolve => { release = resolve })
    }
    return response
  }
  try {
    const adding = sim.addGuest()
    await until(() => held)
    await until(() => sim.state().actors.every(a => !a.busy))
    assert.equal(sim.state().adding, true)
    await assert.rejects(sim.fresh({ count: 1, scenario: 'agreement', paceMs: 700 }), /active admission/)
    assert.equal(replacementCreates, 0); assert.equal(sim.state().shared!.roomId, roomId)
    release!(); await adding
    assert.equal(sim.state().actors.length, 3); assert(sim.state().actors.every(a => a.live)); assert.equal(sim.state().privacyFailures, 0)
    held = false; release = undefined
    const countBeforeClose = sim.state().actors.length
    const delayed = sim.addGuest(); const rejected = assert.rejects(delayed, /admission stopped/)
    await until(() => held)
    sim.close(); release!(); await rejected
    assert.equal(sim.state().actors.length, countBeforeClose); assert.equal(sim.state().shared!.roomId, roomId)
    assert.equal(sim.state().adding, false)
    await assert.rejects(sim.fresh({ count: 1, scenario: 'agreement', paceMs: 700 }), /stopped/)
    assert.equal(replacementCreates, 0)
    // The delayed join really committed at the API; stopping the tool never removes it.
    const response = await originalFetch(`http://127.0.0.1:15994${paths.snapshot(roomId)}`, {
      headers: { Cookie: fresh.cookie.split(';')[0], Origin: 'http://127.0.0.1:8131' } })
    assert.equal(response.status, 200)
    assert.equal(((await response.json()) as RoomSnapshot).shared.participants.length, 4)
  } finally { release?.(); globalThis.fetch = originalFetch }
})
