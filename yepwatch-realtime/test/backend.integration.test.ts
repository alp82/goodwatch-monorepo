import test from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { createServer } from 'node:net'
import { paths, type ApiError, type GuestAdmission, type GuestCredential, type RoomCommand, type RoomSnapshot } from '@goodwatch/yepwatch-contracts'
import { createGateway } from '../src/gateway.js'
import { ValkeyBus } from '../src/bus.js'
import { HttpAuthority } from '../src/authority.js'
import { connect, until, snapshots, sleep } from './client.js'

const exec = promisify(execFile)
async function port() {
  const server = createServer()
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const addr = server.address(); assert(addr && typeof addr !== 'string')
  await new Promise<void>(resolve => server.close(() => resolve()))
  return addr.port
}
// This imports the BACKEND OWNER'S real handler/service in its own subprocess.
// Explicit opt-in: disposable bus + memory repository + synthetic catalog, no live data.
test('Actual backend HTTP hooks + two gateways: guest movies/new shows, continuation denials, private voting and bus recovery', {
  skip: process.env.YEPWATCH_TEST_BACKEND !== '1' || !process.env.YEPWATCH_TEST_VALKEY_IMAGE, timeout: 30_000,
}, async t => {
  const apiPort = await port(), busPort = await port()
  const name = `yepwatch-realtime-backend-test-${process.pid}-${Date.now()}`
  await exec('docker', ['run', '-d', '--name', name, '-p', `127.0.0.1:${busPort}:6379`,
    process.env.YEPWATCH_TEST_VALKEY_IMAGE!, 'valkey-server', '--save', '', '--appendonly', 'no'])
  t.after(async () => { await exec('docker', ['rm', '-f', name]) })
  const serviceSecret = randomBytes(32).toString('base64url')
  const secret = randomBytes(32).toString('base64url')
  const child = spawn(process.execPath, ['--experimental-transform-types', 'goodwatch-webapp/app/server/yepwatch/local-test-server.ts'], {
    cwd: new URL('../..', import.meta.url), env: { PATH: process.env.PATH, YEPWATCH_LOCAL_FIXTURES: '1',
      YEPWATCH_SECRET: secret, YEPWATCH_GATEWAY_SECRET: serviceSecret, YEPWATCH_LOCAL_PORT: String(apiPort),
      YEPWATCH_REVISION_REDIS_URL: `redis://127.0.0.1:${busPort}` }, stdio: ['ignore', 'pipe', 'pipe'],
  })
  t.after(async () => { if (child.exitCode === null) { child.kill('SIGTERM'); await sleep(100); if (child.exitCode === null) child.kill('SIGKILL') } })
  let started = false
  let stderr = ''
  child.stdout.on('data', data => { if (data.toString().includes('YepWatch LOCAL')) started = true })
  child.stderr.on('data', data => { stderr += data })
  await until(() => started || child.exitCode !== null, 4000)
  assert(started, `Backend failed to start: ${stderr}`)
  const origin = `http://127.0.0.1:${apiPort}`
  async function request<T>(path: string, body?: unknown, credential?: GuestCredential, extra: Record<string, string> = {}): Promise<T> {
    const response = await fetch(new URL(path, origin), { method: body === undefined ? 'GET' : 'POST',
      headers: { 'content-type': 'application/json', 'x-yepwatch-client': 'native', ...extra,
        ...(credential ? { Authorization: `Bearer ${credential.token}`, 'X-YepWatch-Participant': credential.participantId } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body) })
    const data = await response.json()
    assert.equal(response.status, 200, `HTTP ${path}: ${JSON.stringify(data)}`)
    return data as T
  }
  const admission = (nickname: string) => ({ commandId: randomBytes(16).toString('hex'), admissionSecret: randomBytes(32).toString('base64url'), nickname })
  const host = await request<GuestAdmission>(paths.rooms, admission('Host'))
  assert.deepEqual(host.snapshot.shared.constraints.kinds, ['movie', 'show_start'])
  const id = host.credential.roomId
  const guest = await request<GuestAdmission>(paths.join(id), { ...admission('Remote guest'), inviteCode: host.invite.code })
  const gateways = [0, 1].map(() => createGateway(new HttpAuthority(origin, serviceSecret),
    new ValkeyBus({ url: `redis://127.0.0.1:${busPort}` }), { port: 0, auditMs: 1000 }))
  const addresses = await Promise.all(gateways.map(g => g.listen()))
  t.after(async () => { for (const gateway of gateways) await gateway.close() })
  const urls = addresses.map(a => { assert(a && typeof a !== 'string'); return `ws://127.0.0.1:${a.port}${paths.realtime}` })
  const ticket = async (c: GuestCredential) => (await request<{ ticket: string }>(paths.realtimeTicket(id), {}, c)).ticket
  const hostTicket = await ticket(host.credential)
  const a = await connect(urls[0], hostTicket, {}, id)
  const b = await connect(urls[1], await ticket(guest.credential), {}, id)
  await until(() => snapshots(a.frames).length > 0 && snapshots(b.frames).length > 0)
  const browserResponse = await fetch(new URL(paths.rooms, origin), { method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'http://localhost:8081' }, body: JSON.stringify(admission('Browser')) })
  assert.equal(browserResponse.status, 200)
  const browser = await browserResponse.json() as GuestAdmission
  assert.equal(browser.credential.token, '')
  const browserTicketResponse = await fetch(new URL(paths.realtimeTicket(browser.credential.roomId), origin), {
    method: 'POST', headers: { origin: 'http://localhost:8081', cookie: browserResponse.headers.get('set-cookie')!.split(';')[0] } })
  assert.equal(browserTicketResponse.status, 200)
  const browserTicket = await browserTicketResponse.json() as { ticket: string }
  const browserSocket = await connect(urls[0], browserTicket.ticket, { origin: 'http://localhost:8081' }, browser.credential.roomId)
  await until(() => snapshots(browserSocket.frames).length > 0)
  browserSocket.ws.close()
  const replay = await connect(urls[1], hostTicket, {}, id)
  await until(() => replay.closed !== undefined); assert.equal(replay.closed, 1008)
  const unauthenticated = await fetch(new URL(paths.realtimeView, origin), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ roomId: id, lease: 'bad' }) })
  assert.equal(unauthenticated.status, 401)
  const read = (c = host.credential) => request<RoomSnapshot>(paths.snapshot(id), undefined, c)
  async function command(c: GuestCredential, cmd: RoomCommand) {
    const current = await read(c)
    return request<{ snapshot: RoomSnapshot }>(paths.commands(id), { commandId: randomBytes(16).toString('hex'), sequence: current.own.nextSequence, command: cmd }, c)
  }
  const beforeDenials = await read()
  async function denied(path: string, body: unknown | undefined, c: GuestCredential,
    status: number, code: ApiError['error']['code'], reason: 'member_auth_unavailable' | 'manual_progress_not_supported') {
    const response = await fetch(new URL(path, origin), {
      method: body === undefined ? 'GET' : 'POST', headers: { 'content-type': 'application/json',
        Authorization: `Bearer ${c.token}`, 'X-YepWatch-Participant': c.participantId },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    assert.equal(response.status, status)
    const failure = await response.json() as ApiError
    assert.equal(failure.error.code, code)
    assert.equal(failure.error.retryable, false)
    assert.deepEqual(failure.error.details, { type: 'access', reason, actions: ['use_guest_modes'] })
    assert.equal(failure.snapshot, undefined)
  }
  async function deniedCommand(cmd: RoomCommand, status: number, code: ApiError['error']['code'],
    reason: 'member_auth_unavailable' | 'manual_progress_not_supported') {
    const current = await read()
    await denied(paths.commands(id), { commandId: randomBytes(16).toString('hex'),
      sequence: current.own.nextSequence, command: cmd }, host.credential, status, code, reason)
  }
  const screens = [{ id: 'couch', label: 'Couch', country: 'DE', serviceIds: [1], confirmed: true },
    { id: 'remote', label: 'Remote', country: 'JP', serviceIds: [1], confirmed: true }]
  await deniedCommand({ type: 'setup', expectedContextVersion: beforeDenials.shared.contextVersion, screens,
    constraints: { kinds: ['movie', 'show_start', 'show_continue'], maxMinutes: null, moods: [] }, screenId: 'couch' },
    403, 'member_required', 'member_auth_unavailable')
  await deniedCommand({ type: 'propose_episode', expectedContextVersion: beforeDenials.shared.contextVersion,
    showId: 10, episodeId: 102 }, 403, 'member_required', 'member_auth_unavailable')
  for (const showId of [10, 999]) {
    await denied(paths.showProgress(id, showId), undefined, guest.credential, 403, 'member_required', 'member_auth_unavailable')
  }
  for (const input of [{ state: 'unknown' }, { state: 'not_started' }, { state: 'continue', nextEpisodeId: 102 }] as const) {
    await deniedCommand({ type: 'show_progress', showId: 10, input, approvedEpisodeId: input.state === 'continue' ? 102 : null },
      400, 'invalid_request', 'manual_progress_not_supported')
  }
  // Denials must not consume sequence, mutate public state or commit manual history.
  assert.deepEqual(await read(), beforeDenials)
  const member = await fetch(new URL(paths.memberStart, origin), { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ returnTo: '/room' }) })
  assert.equal(member.status, 501)
  assert.equal((await member.json() as ApiError).error.code, 'not_implemented')
  await command(host.credential, { type: 'setup', expectedContextVersion: beforeDenials.shared.contextVersion, screens,
    constraints: { kinds: ['movie', 'show_start'], maxMinutes: null, moods: [] }, screenId: 'couch' })
  await command(guest.credential, { type: 'assign_screen', expectedContextVersion: (await read()).shared.contextVersion, screenId: 'remote' })
  await command(guest.credential, { type: 'ready', expectedContextVersion: (await read()).shared.contextVersion, ready: true })
  // The visible host start action can include readiness without a separate ready command.
  assert.equal((await read()).shared.participants.find(p => p.participantId === host.credential.participantId)?.ready, false)
  let current = await read()
  const startedRound = await command(host.credential, { type: 'start_round', hostReady: true, expectedContextVersion: current.shared.contextVersion, expectedRosterVersion: current.shared.rosterVersion })
  const round = startedRound.snapshot.shared.round!.version
  await until(() => snapshots(a.frames).at(-1)?.snapshot.phase === 'voting' && snapshots(b.frames).at(-1)?.snapshot.phase === 'voting')
  assert.deepEqual(snapshots(b.frames).at(-1)!.snapshot.candidates.map(c => c.identity.kind), ['movie', 'show_start'])
  assert.equal(snapshots(b.frames).at(-1)!.snapshot.participants.find(p => p.participantId === host.credential.participantId)?.ready, true)
  const candidates = startedRound.snapshot.shared.candidates
  for (const c of [host.credential, guest.credential]) {
    for (const candidate of candidates) await command(c, { type: 'vote', roundVersion: round, candidateId: candidate.id, expectedVoteRevision: 0, value: 'watch' })
    if (c === host.credential) {
      await command(c, { type: 'complete_round', roundVersion: round })
      const revision = (await read()).shared.revision
      await until(() => snapshots(b.frames).at(-1)!.snapshot.revision >= revision)
      const shared = snapshots(b.frames).at(-1)!.snapshot
      assert.equal(shared.phase, 'voting'); assert.equal(shared.shortlist, null)
      assert.equal(shared.participants.find(p => p.participantId === host.credential.participantId)?.completedCount, candidates.length)
    } else await command(c, { type: 'complete_round', roundVersion: round })
  }
  current = await read(); assert.equal(current.shared.phase, 'shortlist')
  await command(host.credential, { type: 'propose', shortlistVersion: current.shared.shortlist!.version, candidateId: candidates[0].id })
  const proposalVersion = (await read()).shared.shortlist!.proposalVersion
  for (const c of [host.credential, guest.credential]) await command(c, { type: 'consent', proposalVersion, accepted: true })
  await command(host.credential, { type: 'decide', proposalVersion })
  await until(() => snapshots(a.frames).at(-1)?.snapshot.phase === 'decided' && snapshots(b.frames).at(-1)?.snapshot.phase === 'decided')
  await exec('docker', ['stop', '-t', '1', name])
  await until(() => b.frames.some(f => f.type === 'degraded'))
  current = await read()
  const next = await command(host.credential, { type: 'new_round', expectedRevision: current.shared.revision })
  const revision = next.snapshot.shared.revision
  await exec('docker', ['start', name])
  await until(() => snapshots(b.frames).at(-1)!.snapshot.revision >= revision, 6000)
  for (const client of [a, b]) {
    const serialized = JSON.stringify(client.frames)
    for (const privateKey of ['"own"', '"votes"', '"receipt"', '"nextEpisodeId"', '"approvedEpisodeId"', '"sequence"', '"shortlistPreference"']) assert(!serialized.includes(privateKey), privateKey)
    assert(snapshots(client.frames).every(f => f.snapshot.participants.every(p => p.presence === 'unknown')))
  }
})
