import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { crateSql, type Sql } from './repository.server.ts'
import { SqlCreationQuotas, provisionCreationQuotas } from './proposal-creation-quota.ts'
import { DEFAULT_CONTROL, ReleaseControl, provisionControl } from './proposal-release-control.ts'
import { provisionReleaseStore } from './proposal-release-store.ts'
import { ProposalService } from './proposal-service.server.ts'
import { RelationalProposalRepository } from './proposal-relational-repository.ts'
import { ProposalMemoryRepository, proposalFixtureCatalog } from './proposal-test-support.ts'
import { createProposalHandler, CREATOR_COOKIE } from './proposal-http.server.ts'
import { IndeterminateWrite, RoomError } from './errors.ts'
const secret = 'personal-allowance-isolated-test-secret-32'
const request = () => ({ contractVersion: 3 as const, commandId: randomBytes(16).toString('hex'), admissionSecret: randomBytes(32).toString('base64url'), nickname: 'Tester' })
const docker = (...args: string[]) => execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()

test('creation identity: private browser cookie, stable native installation and verified account priority', async () => {
  const creators: (string | undefined)[] = []
  const service = new ProposalService(new ProposalMemoryRepository(), proposalFixtureCatalog, secret, undefined, undefined, {
    active: async () => {}, join: async () => {}, command: async () => {},
    create: async (_room, _admission, creator) => { creators.push(creator); return Date.now() + 86_400_000 }
  })
  const handler = createProposalHandler(service, { serviceSecret: secret, allowedOrigins: ['https://yepwatch.test'] })
  const create = (headers: Record<string, string> = {}) => handler(new Request('https://yepwatch.test/api/yepwatch/v1/proposal/rooms', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://yepwatch.test', ...headers }, body: JSON.stringify(request()) }))
  const first = await create()
  assert.equal(first.status, 200)
  const cookie = first.headers.getSetCookie().find(c => c.startsWith(CREATOR_COOKIE + '='))!
  assert.match(cookie, /HttpOnly; SameSite=Lax; Max-Age=2592000; Secure/)
  assert.equal((await create({ cookie: cookie.split(';')[0] })).status, 200)
  assert.equal(creators[0], creators[1])
  assert.equal((await create({ 'x-yepwatch-client': 'native', 'x-yepwatch-creator': 'a'.repeat(64) })).status, 200)
  assert.equal((await create({ 'x-yepwatch-client': 'native', 'x-yepwatch-creator': 'a'.repeat(64) })).status, 200)
  assert.equal(creators[2], creators[3])
  assert.notEqual(creators[0], creators[2])
  assert.equal((await create({ 'x-yepwatch-client': 'native', 'x-yepwatch-creator': 'malformed' })).status, 400)
  const account = { userId: 'one-account', sessionId: 'device-one', expiresAt: Date.now() + 86_400_000 }
  await service.create(request(), account, 'b'.repeat(64))
  await service.create(request(), { ...account, sessionId: 'device-two' }, 'c'.repeat(64))
  assert.equal(creators[4], creators[5])
  assert.notEqual(creators[4], creators[2])
})

test('Crate personal allowance: ten across instances, more independent people than the old shared cap, retries and expiry cleanup', { skip: process.env.YEPWATCH_TEST_RELATIONAL_CRATE !== '1', timeout: 180000 }, async t => {
  const name = `yepwatch-personal-quota-${process.pid}`
  docker('run', '-d', '--name', name, '-p', '127.0.0.1::4200', '-e', 'CRATE_HEAP_SIZE=512m', 'crate:5.10.16', 'crate', '-Cdiscovery.type=single-node', '-Ccluster.name=' + name)
  t.after(() => docker('rm', '-f', name))
  const port = docker('port', name, '4200/tcp').split(':').at(-1)
  const sql = crateSql(`http://127.0.0.1:${port}`, 'crate', '')
  for (let i = 0; ; i++) {
    try { await sql('SELECT 1'); break } catch (error) { if (i > 100) throw error; await new Promise(r => setTimeout(r, 300)) }
  }
  await provisionReleaseStore(sql, 0, 'personal-test', secret)
  const policy = { ...DEFAULT_CONTROL, admissions: 120 }
  await provisionControl(sql, policy, 0)
  let loseQuota = true, loseProof = true
  const unreliable: Sql = async (stmt, args) => {
    const result = await sql(stmt, args)
    if (stmt.startsWith('INSERT INTO doc.yepwatch_creation_quota ') && loseQuota) { loseQuota = false; throw new IndeterminateWrite('lost quota acknowledgement') }
    if (stmt.startsWith('INSERT INTO doc.yepwatch_creation_reservation ') && loseProof) { loseProof = false; throw new IndeterminateWrite('lost room proof acknowledgement') }
    return result
  }
  const a = new SqlCreationQuotas(unreliable), b = new SqlCreationQuotas(sql)
  const control = new ReleaseControl(sql, policy, a)
  const expiry = await control.create('fixed-room', 'fixed-admission', 'retry-person')
  assert.equal(await new ReleaseControl(sql, policy, b).create('fixed-room', 'fixed-admission', 'retry-person'), expiry)
  await assert.rejects(b.reserve('fixed-room', 'changed-admission', 'retry-person'), (e: unknown) => e instanceof RoomError && e.code === 'conflict')
  const outcomes = await Promise.all(Array.from({ length: 24 }, async (_, i) => {
    for (let retry = 0; ; retry++) {
      try { return await (i % 2 ? a : b).reserve(`parallel-${i}`, `admission-${i}`, 'same-person') }
      catch (e) { if (e instanceof RoomError && e.code === 'busy' && retry < 5) continue; if (e instanceof RoomError && e.code === 'limit_reached') return null; throw e }
    }
  }))
  assert.equal(outcomes.filter(Boolean).length, 10)
  await assert.rejects(a.reserve('eleventh', 'new-admission', 'same-person'), (e: unknown) => e instanceof RoomError && e.code === 'limit_reached' && e.status === 409)
  // 25 people, each one room: more than the removed shared cap of 20.
  for (let i = 0; i < 25; i++) await control.create(`independent-${i}`, `different-admission-${i}`, `person-${i}`)
  await control.join('fixed-room', 'participant-from-full-person', 'join-admission')
  // Same signed-in account uses one allowance even when its device session and guest identity change.
  const service = new ProposalService(new RelationalProposalRepository(sql, secret), proposalFixtureCatalog, secret, undefined, undefined, control)
  const account = { userId: 'same-account', sessionId: 'device-one', expiresAt: Date.now() + 86_400_000 }
  const firstRequest = request()
  const first = await service.create(firstRequest, account, 'guest-one')
  assert.equal((await service.create(firstRequest, account, 'guest-two')).credential.roomId, first.credential.roomId)
  for (let i = 0; i < 9; i++) await service.create(request(), { ...account, sessionId: `device-${i}` }, `guest-${i}`)
  await assert.rejects(service.create(request(), account, 'new-guest'), (e: unknown) => e instanceof RoomError && e.code === 'limit_reached')
  await service.create(request(), { ...account, userId: 'another-account' })
  // Expired metadata is removed; a concurrent new reservation must survive cleanup's CAS delete.
  await b.reserve('expired-room', 'expired-admission', 'expired-person')
  await sql('UPDATE doc.yepwatch_creation_quota SET expires_at=0 WHERE creator_digest=?', ['expired-person'])
  await sql('UPDATE doc.yepwatch_creation_reservation SET expires_at=0 WHERE room_id=?', ['expired-room'])
  await sql('REFRESH TABLE doc.yepwatch_creation_quota,doc.yepwatch_creation_reservation')
  let renewed = false
  const racing: Sql = async (stmt, args) => {
    if (stmt.startsWith('DELETE FROM doc.yepwatch_creation_quota ') && args?.[0] === 'expired-person' && !renewed) {
      renewed = true
      await b.reserve('renewed-room', 'renewed-admission', 'expired-person')
    }
    return sql(stmt, args)
  }
  await new SqlCreationQuotas(racing).purgeExpired()
  assert.equal(renewed, true)
  await b.active('renewed-room')
  assert.equal((await sql('SELECT room_id FROM doc.yepwatch_creation_reservation WHERE room_id=?', ['expired-room'])).rows.length, 0)
  await provisionCreationQuotas(sql, 0) // Additive rerun preserves all live allowances.
  await b.active('fixed-room', expiry)
})
