/** Explicit fresh-room integration; never invoked by npm test. No room/invite input accepted. */
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { paths, REVISION_CHANNEL, type GuestAdmission, type GuestCredential, type RoomSnapshot, type RoomCommand, type CommandEnvelope, type ServerRealtimeFrame } from '@goodwatch/yepwatch-contracts/continuous'
import { createGateway } from '../src/gateway.js'
import { HttpAuthority } from '../src/authority.js'
import { ValkeyBus } from '../src/bus.js'
import { ValkeyActivityBus } from '../src/activity.js'
import { continuousProjection } from '../src/continuous-projection.js'
import { connect, until, sleep } from './client.js'
const origin = process.env.YEPWATCH_API_ORIGIN
const websocket = process.env.YEPWATCH_LIVE_WS_ORIGIN ?? 'ws://127.0.0.1:4321'
const secret = process.env.YEPWATCH_GATEWAY_SECRET
const realSample = process.env.YEPWATCH_LIVE_CATALOG === 'real-sample'
const serviceId = Number(process.env.YEPWATCH_LIVE_SERVICE_ID ?? '1')
assert(Number.isSafeInteger(serviceId) && serviceId > 0)
assert(origin && new URL(origin).hostname === '127.0.0.1' && secret)
assert(new URL(websocket).hostname === '127.0.0.1')
const nonce = (bytes = 24) => randomBytes(bytes).toString('base64url')
async function request<T>(path: string, body?: unknown, credential?: GuestCredential) {
  const response = await fetch(new URL(path, origin), { method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', 'X-YepWatch-Client': 'native',
      ...(credential ? { Authorization: `Bearer ${credential.token}`, 'X-YepWatch-Participant': credential.participantId } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(12_000) })
  const data = await response.json()
  assert.equal(response.status, 200, `HTTP status=${response.status} code=${data.error?.code ?? 'unknown'}`)
  return data as T
}
const admission = (nickname: string) => ({ contractVersion: 2 as const, nickname, commandId: nonce(), admissionSecret: nonce(32) })
const host = await request<GuestAdmission>(paths.rooms, admission('Transport host'))
const id = host.credential.roomId
const read = (c: GuestCredential) => request<RoomSnapshot>(paths.snapshot(id), undefined, c)
async function command(c: GuestCredential, input: (s: RoomSnapshot) => RoomCommand) {
  const current = await read(c)
  return request<{ snapshot: RoomSnapshot }>(paths.commands(id), { commandId: nonce(), sequence: current.own.nextSequence, command: input(current) }, c)
}
await command(host.credential, s => ({ type: 'setup', expectedContextVersion: s.shared.contextVersion,
  screens: [{ id: 'demo', label: 'Disposable integration screen', country: 'DE', serviceIds: [serviceId], confirmed: true }],
  constraints: { kinds: ['movie', 'show_start'], maxMinutes: null, moods: [] }, screenId: 'demo' }))
const guest = await request<GuestAdmission>(paths.join(id), { ...admission('Transport guest'), inviteCode: host.invite.code, screenId: 'demo' })
await command(guest.credential, s => ({ type: 'ready', expectedContextVersion: s.shared.contextVersion, ready: true }))
const busConfig = { url: process.env.YEPWATCH_VALKEY_URL }
const secondary = createGateway(new HttpAuthority(origin, secret, 3000, 2_000_000, paths),
  new ValkeyBus(busConfig, REVISION_CHANNEL), { port: 0, origins: ['http://127.0.0.1:8131'] }, { activityBus: new ValkeyActivityBus(busConfig) })
const address = await secondary.listen(); assert(address && typeof address !== 'string')
const clients: Awaited<ReturnType<typeof connect<ServerRealtimeFrame>>>[] = []
const ticket = (c: GuestCredential) => request<{ ticket: string }>(paths.realtimeTicket(id), {}, c)
const open = async (c: GuestCredential, ws = websocket) => {
  const client = await connect<ServerRealtimeFrame>(`${ws}${paths.realtime}`, (await ticket(c)).ticket, {}, id)
  clients.push(client); await until(() => client.frames.some(f => f.type === 'activity.session'), 5000); return client
}
try {
  const firstTicket = (await ticket(host.credential)).ticket
  const a = await connect<ServerRealtimeFrame>(`${websocket}${paths.realtime}`, firstTicket, {}, id); clients.push(a)
  await until(() => a.frames.some(f => f.type === 'activity.session'), 5000)
  const b = await open(guest.credential, `ws://127.0.0.1:${address.port}`)
  const replay = await connect<ServerRealtimeFrame>(`${websocket}${paths.realtime}`, firstTicket, {}, id); clients.push(replay)
  await until(() => replay.closed === 1008)
  const start = await command(host.credential, s => ({ type: 'start', hostReady: true, expectedRosterVersion: s.shared.rosterVersion, expectedContextVersion: s.shared.contextVersion }))
  assert.equal(start.snapshot.shared.phase, 'choosing'); assert(start.snapshot.shared.candidates.length > 0)
  if (realSample) assert(start.snapshot.shared.candidates.every(c => !c.title.startsWith('Fixture ') && c.identity.tmdbId > 0), 'Real sample must not contain fixture titles')
  const presentation = { candidates: start.snapshot.shared.candidates.length,
    kinds: [...new Set(start.snapshot.shared.candidates.map(c => c.identity.kind))],
    withBackdrop: start.snapshot.shared.candidates.filter(c => !!c.backdropUrl).length,
    withScore: start.snapshot.shared.candidates.filter(c => c.goodwatchScore != null).length,
    withTrailer: start.snapshot.shared.candidates.filter(c => !!c.trailerUrl).length,
    withGenres: start.snapshot.shared.candidates.filter(c => !!c.genres?.length).length }
  const candidateId = start.snapshot.shared.candidates[0].id
  const before = await read(host.credential)
  const envelope: CommandEnvelope = { commandId: nonce(), sequence: before.own.nextSequence,
    command: { type: 'vote', generation: before.shared.generation, candidateId, expectedVoteRevision: 0, value: 'watch' } }
  await request(paths.commands(id), envelope, host.credential); await request(paths.commands(id), envelope, host.credential)
  assert.equal((await read(host.credential)).own.votes.find(v => v.candidateId === candidateId)?.revision, 1)
  assert.equal((await read(host.credential)).shared.matches.length, 0)
  await command(guest.credential, s => ({ type: 'vote', generation: s.shared.generation, candidateId, expectedVoteRevision: 0, value: 'watch' }))
  await until(() => b.frames.some(f => (f.type === 'room.updated' || f.type === 'room.snapshot') && f.snapshot.matches.some(m => m.candidateId === candidateId)), 5000)
  await command(host.credential, s => ({ type: 'pick', generation: s.shared.generation, expectedRosterVersion: s.shared.rosterVersion, candidateId, expectedPickRevision: s.own.pick.revision }))
  assert.equal((await read(guest.credential)).shared.matches[0].pickCount, 1)
  const ack = a.frames.find(f => f.type === 'activity.session'); assert(ack)
  a.ws.send(JSON.stringify({ type: 'activity', sessionId: ack.sessionId, sequence: 0, view: 'trailer', gesture: 'reach' }))
  await until(() => b.frames.some(f => f.type === 'activity' && f.view === 'trailer'))
  const late = await request<GuestAdmission>(paths.join(id), { ...admission('Transport late guest'), inviteCode: host.invite.code, screenId: 'demo' })
  assert.equal(late.snapshot.shared.matches.length, 0); assert.equal((await read(host.credential)).own.pick.candidateId, null)
  let c = await open(late.credential)
  await command(late.credential, s => ({ type: 'vote', generation: s.shared.generation, candidateId, expectedVoteRevision: 0, value: 'watch' }))
  for (const credential of [host.credential, guest.credential]) await command(credential, s => ({ type: 'pick', generation: s.shared.generation,
    expectedRosterVersion: s.shared.rosterVersion, candidateId, expectedPickRevision: s.own.pick.revision }))
  assert.equal((await read(host.credential)).shared.phase, 'choosing')
  const previousSession = c.frames.find(f => f.type === 'activity.session')!.sessionId
  c.ws.close(); await until(() => c.closed !== undefined)
  assert.equal((await read(host.credential)).shared.participants.length, 3)
  assert.equal((await read(host.credential)).shared.phase, 'choosing')
  c = await open(late.credential)
  assert.notEqual(c.frames.find(f => f.type === 'activity.session')!.sessionId, previousSession)
  const done = await command(late.credential, s => ({ type: 'pick', generation: s.shared.generation,
    expectedRosterVersion: s.shared.rosterVersion, candidateId, expectedPickRevision: s.own.pick.revision }))
  assert.equal(done.snapshot.shared.phase, 'decided')
  await until(() => [a, b, c].every(client => client.frames.some(f => (f.type === 'room.snapshot' || f.type === 'room.updated') && f.snapshot.phase === 'decided')), 5000)
  for (const client of clients) for (const frame of client.frames) {
    if (frame.type === 'room.snapshot' || frame.type === 'room.updated') continuousProjection(frame.snapshot, id)
    if (frame.type === 'activity') {
      const required = ['type', 'roomId', 'participantId', 'sessionId', 'sequence', 'serverTime', 'expiresAt', 'view']
      assert(required.every(key => key in frame))
      assert(Object.keys(frame).every(key => [...required, 'gesture', 'beat'].includes(key)))
    }
  }
  // Cookie admission/ticket on a separate fresh room proves real browser credential delivery.
  const browserResponse = await fetch(new URL(paths.rooms, origin), { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://127.0.0.1:8131' }, body: JSON.stringify(admission('Disposable browser')) })
  assert.equal(browserResponse.status, 200)
  const browser = await browserResponse.json() as GuestAdmission; assert.equal(browser.credential.token, '')
  const cookie = browserResponse.headers.get('set-cookie'); assert(cookie); assert(cookie.includes('HttpOnly'))
  const browserTicket = await fetch(new URL(paths.realtimeTicket(browser.credential.roomId), origin), { method: 'POST',
    headers: { Cookie: cookie.split(';')[0], Origin: 'http://127.0.0.1:8131' } })
  assert.equal(browserTicket.status, 200)
  const browserWs = await connect<ServerRealtimeFrame>(`${websocket}${paths.realtime}`, (await browserTicket.json()).ticket,
    { origin: 'http://127.0.0.1:8131' }, browser.credential.roomId); clients.push(browserWs)
  await until(() => browserWs.frames.some(f => f.type === 'activity.session'), 5000)
  const denied = await fetch(new URL(paths.realtimeView, origin), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomId: id, lease: 'bad' }) })
  assert.equal(denied.status, 401)
  const report = { result: 'PASS', api: origin, gateway: websocket, secondGateway: 'Ephemeral actual second gateway',
    storage: 'Backend-owner isolated disposable Crate5.10.16/tablev2',
    catalog: realSample ? 'Finite real-catalog sample via actual API; not full-catalog coverage' : 'Explicitly synthetic backend catalog; not real-catalog coverage',
    presentation,
    checks: ['3 independent actual identities', 'Actual browser HttpOnly ticket/session', 'One-use replay rejected', 'Same-envelope command retry',
      'Immediate unanimous match without completion', 'Aggregate pickcount only', 'Latejoin invalidates match and own pick', 'Disconnect preserves required voter',
      'Fresh-ticket reconnect/new activity session', 'All current picks trigger fresh-check automatic Done', 'Cross-gateway neutral trailer activity', 'Strict nested shared-only snapshots', 'Internal service auth required'],
    frames: clients.reduce((n, c) => n + c.frames.length, 0), capabilitiesInvitesAndPrivateVotesRedacted: true }
  await writeFile(new URL(realSample ? '../artifacts/continuous-live-real-smoke.json' : '../artifacts/continuous-live-smoke.json', import.meta.url), JSON.stringify(report, null, 2) + '\n')
  console.info(`PASS actual durable continuous API + two gateways + Valkey; ${realSample ? 'finite real sample' : 'synthetic catalog'}, fresh disposable rooms only.`)
} finally { for (const client of clients) client.ws.close(); await secondary.close(); await sleep(20) }
