import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { paths, type ServerRealtimeFrame, type ServerActivity } from '@goodwatch/yepwatch-contracts/proposal'
import { createGateway } from '../src/gateway.js'
import type { ActivityBus, ActivityFrame } from '../src/activity.js'
import { proposalProjection } from '../src/proposal-projection.js'
import { cheerAllowed, proposalClientActivitySchema } from '../src/proposal-activity.js'
import { fixture, FakeBus, proposalSnapshot } from './fixture.js'
import { connect, until, sleep } from './client.js'

function choosing() {
  const s = proposalSnapshot(); s.phase = 'choosing'
  s.candidates = [1, 2].map(n => ({ id: `movie:${n}`, identity: { kind: 'movie' as const, tmdbId: n }, title: `Shared match ${n}`,
    year: 2020, overview: null, posterUrl: null, runtimeMinutes: 90, viewingDuration: { minutes: 90, scope: 'movie' as const }, availability: [] }))
  s.matches = s.candidates.map(c => ({ candidateId: c.id, averageYepMs: null }))
  s.proposalVersion = 1; s.proposal = { candidateId: 'movie:1', version: 1, previousCandidateId: null, agreeCount: 1, requiredCount: 2, averageYepMs: null }
  return s
}
class ActivityHub {
  buses: MemoryActivity[] = []
  bus() { const b = new MemoryActivity(this); this.buses.push(b); return b }
  emit(frame: ActivityFrame) { for (const b of this.buses) if (b.ready) b.emit('activity', frame) }
}
class MemoryActivity extends EventEmitter implements ActivityBus {
  ready = true
  constructor(private hub: ActivityHub) { super() }
  async start() {}
  async publish(frame: ActivityFrame) { this.hub.emit(frame); return true }
  state(ready: boolean) { this.ready = ready; this.emit('state', ready) }
  close() {}
}
async function setup(t: test.TestContext, pointers = false, roomDetails = false, cheers = false) {
  const api = await fixture('proposal'); api.state.shared = choosing(); if (roomDetails) { api.state.shared.savedServiceIds = [8,337]; api.state.shared.description = {prompt:'A cosy mystery',attributes:[{text:'Mystery',kind:'want'}]}; api.state.shared.participants.push({participantId:'person-3',nickname:'Dropped',screenId:'screen-1',ready:true,dropped:true}) }; api.state.leaseMs = 60_000
  const hub = new ActivityHub(), buses = [new FakeBus(), new FakeBus()], activities = [hub.bus(), hub.bus()]
  const gateways = buses.map((b, n) => createGateway(api.authority, b, { port: 0, auditMs: 1000 }, { activityBus: activities[n], proposal: true }))
  const addresses = await Promise.all(gateways.map(g => g.listen()))
  t.after(async () => { await Promise.all(gateways.map(g => g.close())); await api.close() })
  const clients = await Promise.all(addresses.map((a, n) => {
    assert(a && typeof a !== 'string');
    return connect<ServerRealtimeFrame>(`ws://127.0.0.1:${a.port}${paths.realtime}`).then(client => {
      client.ws.send(JSON.stringify({type:'authenticate',ticket:api.ticket(`person-${n+1}`),roomId:'room-1',lastRevision:null,...(pointers && n === 1 ? {pointers:true}: {}),...(roomDetails && n === 1 ? {roomDetails:true}: {}),...(cheers && n === 1 ? {cheers:true}: {})}));return client;
    })
  }))
  await until(() => clients.every(c => c.frames.some(f => f.type === 'activity.session')))
  return { api, hub, buses, activities, clients }
}
const events = (frames: ServerRealtimeFrame[]) => frames.filter((f): f is ServerActivity => f.type === 'activity')
const session = (frames: ServerRealtimeFrame[]) => frames.find(f => f.type === 'activity.session')!.sessionId
const send = (client: Awaited<ReturnType<typeof connect<ServerRealtimeFrame>>>, sequence: number, extra = {}) =>
  client.ws.send(JSON.stringify({ type: 'activity', sessionId: session(client.frames), sequence, view: 'matches', ...extra }))

test('Proposal projection is strict, anonymous and accepts pending latejoin with honest missing timing', () => {
  const s = choosing(); assert.equal(proposalProjection(s, s.roomId).proposal?.agreeCount, 1)
  const late = structuredClone(s); late.matches = []; late.participants.push({ participantId: 'late', nickname: 'Late', ready: false, screenId: null }); late.proposal!.requiredCount++
  assert.equal(proposalProjection(late, late.roomId).proposal?.candidateId, 'movie:1')
  const changes = [
    (x: any) => { x.proposal.proposerParticipantId = 'person-1' }, (x: any) => { x.proposal.agreedBy = ['person-1'] },
    (x: any) => { x.matches[0].individualTimes = [100, 200] }, (x: any) => { x.participants[0].agreed = true },
    (x: any) => { x.candidates[0].currentVoter = 'person-1' }, (x: any) => { x.own = { agreement: true } },
    (x: any) => { x.matches[0].averageYepMs = -1 }, (x: any) => { x.proposal.agreeCount = 3 },
    (x: any) => { x.proposal.requiredCount = 1 }, (x: any) => { x.proposal.version = 4 },
    (x: any) => { x.candidates[0].viewingDuration.scope = 'episode' }, (x: any) => { x.matches[0].pickCount = 1 },
    (x: any) => { x.candidates[0].identity.activeExposureMs = 100 },
  ]
  for (const change of changes) { const bad = structuredClone(s); change(bad); assert.throws(() => proposalProjection(bad, s.roomId)) }
})

test('Inspection exact shapes exclude private targets and agreement-person events', () => {
  const base = { type: 'activity', sessionId: 'session', sequence: 1, view: 'matches' }
  for (const inspection of [{ kind: 'poster', candidateId: 'movie:1' }, { kind: 'lens' }, { kind: 'dice' }]) assert(proposalClientActivitySchema.safeParse({ ...base, inspection }).success)
  for (const extra of [{ inspection: { kind: 'dice', candidateId: 'movie:1' } }, { inspection: { kind: 'poster', candidateId: 'movie:1' }, view: 'voting' },
    { inspection: { kind: 'lens', x: .5 } }, { inspection: { kind: 'poster', candidateId: 'movie:1' }, beat: 'answer' },
    { agreed: true }, { activeExposureMs: 50 }, { proposalVersion: 2 }, { value: 'watch' }])
    assert(!proposalClientActivitySchema.safeParse({ ...base, ...extra }).success)
})

test('Actual two-gateway proposal clients: scoped poster/lens/dice, action-only TTL, coalescing and durable aggregates', async t => {
  const { api, hub, buses, clients: [a, b] } = await setup(t)
  send(a, 0, { inspection: { kind: 'poster', candidateId: 'private-unmatched-card' } }); await sleep(280)
  assert.equal(events(b.frames).length, 0)
  send(a, 1, { inspection: { kind: 'poster', candidateId: 'movie:1' } })
  await until(() => events(b.frames).some(f => f.inspection?.kind === 'poster'))
  send(a, 2, { inspection: { kind: 'lens' } }); await until(() => events(b.frames).some(f => f.inspection?.kind === 'lens'))
  send(a, 3, { inspection: { kind: 'dice' } }); await until(() => events(b.frames).some(f => f.inspection?.kind === 'dice'))
  const old = events(b.frames).at(-1)!, before = events(b.frames).length
  hub.emit({ ...old, sequence: 30, serverTime: Date.now() - 1700, expiresAt: Date.now() + 3500 })
  await until(() => events(b.frames).length > before); assert.equal(events(b.frames).at(-1)!.inspection, undefined)
  // A view heartbeat is real presence, and must not recreate an inspection cue.
  send(a, 31); await until(() => events(b.frames).some(f => f.sequence === 31)); assert.equal(events(b.frames).at(-1)!.inspection, undefined)
  // Queued inspection becomes ineligible when a confirmed late join removes its match.
  send(a, 32, { inspection: { kind: 'poster', candidateId: 'movie:1' } })
  api.state.shared.matches = []; api.state.shared.revision++
  api.state.shared.participants.push({ participantId: 'late', nickname: 'Late', screenId: null, ready: false }); api.state.shared.proposal.requiredCount = 3
  buses.forEach(bus => bus.hint(api.state.shared.revision))
  await until(() => b.frames.some(f => f.type === 'room.updated' && f.snapshot.revision === 2))
  await sleep(300); assert(!events(b.frames).some(f => f.sequence === 32))
  hub.emit({ ...old, sequence: 33, serverTime: Date.now(), expiresAt: Date.now() + 5000 }); await sleep(30)
  assert(!events(b.frames).some(f => f.sequence === 33))
  const shared = b.frames.findLast(f => f.type === 'room.updated'); assert(shared?.type === 'room.updated')
  assert.equal(shared.snapshot.proposal?.requiredCount, 3); assert.equal(shared.snapshot.proposal?.agreeCount, 1)
})

test('Proposal delivery outage clears queued inspection and repairs only through an authorized shared snapshot', async t => {
  const { api, activities, buses, clients: [a, b] } = await setup(t)
  activities[0].state(false); await until(() => a.frames.some(f => f.type === 'degraded'))
  send(a, 0, { inspection: { kind: 'dice' } }); await sleep(280); assert.equal(events(b.frames).length, 0)
  api.state.shared.revision++; activities[0].state(true); buses[0].hint(api.state.shared.revision); buses[1].hint(api.state.shared.revision)
  await until(() => a.frames.some(f => f.type === 'room.snapshot' && f.snapshot.revision === 2))
  send(a, 1, { inspection: { kind: 'lens' } }); await until(() => events(b.frames).some(f => f.inspection?.kind === 'lens'))
  assert(!events(b.frames).some(f => f.inspection?.kind === 'dice'))
})


test('two gateways relay bounded live pointers only to opted-in clients, never answers', async t => {
 const {hub,clients:[old,modern]}=await setup(t,true);
 const pointer={x:.25,y:.75,pressed:true,kind:'touch'};
 send(old,0,{view:'voting',pointer});
 await until(()=>events(modern.frames).some(f=>f.pointer));
 assert.deepEqual(events(modern.frames).at(-1)!.pointer,pointer);
 send(modern,0,{view:'voting',pointer});
 await until(()=>events(old.frames).length>0);
 assert.equal(events(old.frames).at(-1)!.pointer,undefined);
 const received=events(modern.frames).at(-1)!;
 hub.emit({...received,sequence:5,serverTime:Date.now()-1600,expiresAt:Date.now()+3000});
 await until(()=>events(modern.frames).some(f=>f.sequence===5));
 assert.equal(events(modern.frames).at(-1)!.pointer,undefined);
 const base={type:'activity',sessionId:'session',sequence:1,view:'voting'};
 for(const extra of [{pointer:{...pointer,x:1.1}},{pointer:{...pointer,y:-.1}},{pointer:{...pointer,choice:'watch'}},{pointer,view:'away'},{pointer,view:'matches'}])
  assert(!proposalClientActivitySchema.safeParse({...base,...extra}).success);
 send(old,6,{view:'voting',pointer:null});
 await until(()=>events(modern.frames).some(f=>f.pointer===null));
});

test('Room descriptions reach capable clients without breaking older strict projections', async (t) => {
  const {
    clients: [old, current],
  } = await setup(t, false, true)
  const before = old.frames.find((f) => f.type === 'room.snapshot')!
  const after = current.frames.find((f) => f.type === 'room.snapshot')!
  if (before.type !== 'room.snapshot' || after.type !== 'room.snapshot') throw new Error('Missing snapshots')
  assert.equal(Object.hasOwn(before.snapshot, 'description'), false)
  assert.equal(Object.hasOwn(before.snapshot, 'savedServiceIds'), false)
  assert.deepEqual(after.snapshot.savedServiceIds, [8,337])
  assert.equal(after.snapshot.description?.prompt, 'A cosy mystery')
  assert.equal(before.snapshot.participants.length, 2)
  assert.equal(after.snapshot.participants.length, 3)
  assert.equal(after.snapshot.participants[2].dropped, true)
  assert.deepEqual(after.snapshot.description?.attributes, [
    { text: 'Mystery', kind: 'want' },
  ])
})

test('Dropped places remain visible but are excluded from required agreement; completed decisions survive return', () => {
 const s = choosing()
 s.participants[1].dropped = true
 s.proposal!.requiredCount = 1
 assert.equal(proposalProjection(s, s.roomId).participants[1].dropped, true)
 s.phase = 'decided'
 s.decision = {candidateId:s.candidates[0].id,proposalVersion:1,decidedAt:Date.now(),availability:[]}
 s.participants[1].dropped = false
 s.proposal!.requiredCount = 2
 s.matches = []
 assert.equal(proposalProjection(s,s.roomId).phase,'decided')
})


test('Decision cheer has a bounded public shape and current-generation scope', () => {
  const frame = { type: 'activity', sessionId: 'session', sequence: 1, view: 'matches', cheer: { kind: 'hold', generation: 1, seed: 13 } }
  assert(proposalClientActivitySchema.safeParse(frame).success)
  for (const change of [{ view: 'voting' }, { gesture: 'handle' }, { inspection: { kind: 'dice' } },
    { cheer: { ...frame.cheer, seed: -1 } }, { cheer: { ...frame.cheer, seed: 2147483648 } },
    { cheer: { ...frame.cheer, participantId: 'other' } }, { cheer: { ...frame.cheer, generation: 1.5 } }])
    assert(!proposalClientActivitySchema.safeParse({ ...frame, ...change }).success)
  const cheer = { cheer: { kind: 'hold' as const, generation: 1, seed: 13 } }
  const scope = { phase: 'decided', generation: 1, participants: [{ participantId: 'one' }] }
  assert(cheerAllowed(cheer, scope, 'one'))
  assert(!cheerAllowed(cheer, { ...scope, phase: 'choosing' }, 'one'))
  assert(!cheerAllowed(cheer, { ...scope, generation: 2 }, 'one'))
  assert(!cheerAllowed(cheer, { ...scope, participants: [{ participantId: 'one', dropped: true }] }, 'one'))
})

test('Two gateways relay decision cheers to capable clients; stale and restarted-generation cheers disappear', async t => {
  const { api, hub, buses, clients: [old, modern] } = await setup(t, false, false, true)
  const generation = api.state.shared.generation
  const cheer = { kind: 'hold', generation, seed: 735 }
  send(old, 0, { cheer })
  await sleep(300)
  assert.equal(events(modern.frames).length, 0, 'not a celebration before a decision')
  api.state.shared.phase = 'decided'
  api.state.shared.decision = { candidateId: 'movie:1', proposalVersion: 1, decidedAt: Date.now(), availability: [] }
  api.state.shared.revision++
  buses.forEach(bus => bus.hint(api.state.shared.revision))
  await until(() => modern.frames.some(f => f.type === 'room.updated' && f.snapshot.phase === 'decided'))
  send(old, 1, { cheer })
  await until(() => events(modern.frames).some(f => f.cheer?.kind === 'hold'))
  const first = events(modern.frames).find(f => f.cheer)!
  assert.deepEqual(first.cheer, cheer)
  assert.equal(first.participantId, 'person-1')
  send(modern, 0, { cheer: { ...cheer, kind: 'tap' } })
  await until(() => events(old.frames).length > 0)
  assert.equal(events(old.frames).at(-1)!.cheer, undefined, 'old strict clients never receive new field')
  hub.emit({ ...first, sequence: 20, serverTime: Date.now() - 1600, expiresAt: Date.now() + 3000 })
  await until(() => events(modern.frames).some(f => f.sequence === 20))
  assert.equal(events(modern.frames).find(f => f.sequence === 20)!.cheer, undefined)
  send(old, 21)
  await until(() => events(modern.frames).some(f => f.sequence === 21))
  assert.equal(events(modern.frames).find(f => f.sequence === 21)!.cheer, undefined, 'heartbeat has no cheer replay')
  send(old, 22, { cheer: { ...cheer, kind: 'release' } })
  await until(() => events(modern.frames).some(f => f.cheer?.kind === 'release'))
  const before = events(modern.frames).length
  // A new round fences both queued sender frames and already-published old-generation events.
  send(old, 23, { cheer })
  api.state.shared = { ...choosing(), generation: generation + 1, revision: api.state.shared.revision + 1 }
  buses.forEach(bus => bus.hint(api.state.shared.revision))
  await until(() => modern.frames.some(f => f.type === 'room.updated' && f.snapshot.generation === generation + 1))
  hub.emit({ ...first, sequence: 24, serverTime: Date.now(), expiresAt: Date.now() + 3000 })
  await sleep(300)
  assert(!events(modern.frames).slice(before).some(f => f.cheer), 'no old decision cheer after restart')
})
