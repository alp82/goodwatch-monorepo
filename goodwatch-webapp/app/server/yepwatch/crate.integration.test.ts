import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { crateSql, CrateRoomRepository, installRoomTable } from './repository.server.ts'
import { YepWatchService } from './service.server.ts'
import { fixtureCatalog } from './test-support.ts'
import { IndeterminateWrite } from './errors.ts'
const origin = process.env.YEPWATCH_TEST_CRATE_ORIGIN
const secret = 'local-crate-integration-test-secret-at-least-32'
const admission = (nickname = 'A') => ({ commandId: randomBytes(16).toString('hex'), admissionSecret: randomBytes(32).toString('base64url'), nickname })
test('Disposable Crate: concurrent CAS, realtime PK reads, durable encrypted state, duplicate insert and lost acknowledgement recovery', { skip: !origin }, async () => {
  const sql = crateSql(origin!, 'crate', ''); await installRoomTable(sql, 0)
  const repo = new CrateRoomRepository(sql, secret); const second = new CrateRoomRepository(sql, secret)
  const service = new YepWatchService(repo, fixtureCatalog, secret)
  const created = await service.create(admission()); const id = created.credential.roomId
  const initial = (await repo.read(id))!
  assert.ok(initial); assert.equal(initial.room.revision, 1)
  // No REFRESH required for complete-primary-key read immediately after insert.
  const raw = (await sql('SELECT payload FROM doc.yepwatch_room WHERE id=?', [id])).rows[0][0]
  assert.ok(!String(raw).includes('tokenHash')); assert.ok(!String(raw).includes('nickname'))
  assert.equal(await repo.insert(initial.room), false)
  const a = structuredClone(initial.room); a.revision++; a.contextVersion++
  const b = structuredClone(initial.room); b.revision++; b.rosterVersion++
  const results = await Promise.all([repo.compareAndSwap(initial, a, true), second.compareAndSwap(initial, b, true)])
  assert.equal(results.filter(Boolean).length, 1)
  const winner = (await second.read(id))!; assert.equal(winner.room.revision, 2); assert.ok(winner.seq > initial.seq)
  const casBeforeTicket = winner.seq
  const credential = { participantId: created.credential.participantId, token: created.credential.token }
  const ticket = await service.ticket(id, credential)
  const attached = await Promise.allSettled([service.attach(id, ticket.ticket), new YepWatchService(second, fixtureCatalog, secret).attach(id, ticket.ticket)])
  assert.equal(attached.filter(r => r.status === 'fulfilled').length, 1)
  assert.ok((await repo.read(id))!.seq > casBeforeTicket)
  // Simulate server committed to real Crate but HTTP response to API process was lost.
  let lose = true
  const ambiguous = new CrateRoomRepository(async (stmt, args) => { const result = await sql(stmt, args); if (lose && stmt.startsWith('UPDATE doc.yepwatch_room SET payload=')) { lose = false; throw new IndeterminateWrite('Injected transport disconnect after commit') }; return result }, secret)
  const retrying = new YepWatchService(ambiguous, fixtureCatalog, secret)
  const command = { commandId: 'ambiguous_real_crate', sequence: 1, command: { type: 'setup' as const, expectedContextVersion: winner.room.contextVersion, screens: [{ id: 'shared', label: 'TV', country: 'DE', serviceIds: [1], confirmed: true }], constraints: { kinds: ['movie' as const], maxMinutes: null, moods: [] }, screenId: 'shared' } }
  const applied = await retrying.command(id, credential, command)
  const replay = await service.command(id, credential, command)
  assert.equal(applied.receipt.appliedRevision, replay.receipt.appliedRevision); assert.equal(replay.snapshot.own.nextSequence, 2)
  const restarted = new YepWatchService(new CrateRoomRepository(sql, secret), fixtureCatalog, secret)
  assert.equal((await restarted.read(id, credential)).shared.contextVersion, winner.room.contextVersion + 1)
})
