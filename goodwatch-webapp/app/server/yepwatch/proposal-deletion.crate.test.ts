import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { SqlDeletionStore, RECOVERY_MS } from './proposal-deletion.ts';
import { RelationalProposalRepository, provisionRelationalRooms } from './proposal-relational-repository.ts';
import { accountHistoryTable, accountIndexTable, deletionTable, tables } from './proposal-storage-schema.ts';
import { ProposalService } from './proposal-service.server.ts';
import { proposalFixtureCatalog } from './proposal-test-support.ts';
import { crateSql } from './repository.server.ts';

const origin = process.env.YEPWATCH_DELETION_TEST_ORIGIN;
test('real Crate deletion survives a process restart, restores before deadline, then erases personal versions and preserves a peer’s history', { skip: !origin }, async () => {
  assert.equal(new URL(origin!).hostname, '127.0.0.1');
  assert.equal(new URL(origin!).port, '15871', 'This proof is restricted to its dedicated disposable database');
  const sql = crateSql(origin!, 'crate', '');
  const secret = 'disposable-deletion-proof-secret-at-least-thirty-two';
  await provisionRelationalRooms(sql, 0);
  const existing = (await sql(`SELECT id FROM ${deletionTable.name} LIMIT 1`)).rows;
  assert.deepEqual(existing, [], 'Refuse to reuse a lifecycle store with existing requests');
  let now = Date.now();
  const runId = randomBytes(8).toString('hex');
  const peerId = `keep-mia-${runId}`;
  const repo = new RelationalProposalRepository(sql, secret);
  const service = new ProposalService(repo, proposalFixtureCatalog, secret, async () => {}, () => now);
  const account = { userId: `delete-alex-${runId}`, sessionId: `alex-device-${runId}`, expiresAt: now + 90 * 86400_000 };
  const input = { contractVersion: 3 as const, commandId: randomBytes(16).toString('hex'), admissionSecret: randomBytes(32).toString('base64url'), nickname: 'Alex' };
  const guest = await service.create(input, account);
  const roomId = guest.credential.roomId;
  await repo.accountStore.publish([{ id: `shared-decision-${runId}`, roomId, roomLabel: 'Alex’s room', title: 'A movie', year: 2026, posterUrl: null, decidedAt: now, people: ['Alex', 'Mia'], participantIds: [guest.credential.participantId, 'mia'], accountIds: [account.userId, peerId] }]);
  const first = await service.deleteAccount(account);
  const restarted = new SqlDeletionStore(sql, secret);
  assert.deepEqual(await restarted.get({ kind: 'account', userId: account.userId }), first);
  await restarted.restore({ kind: 'account', userId: account.userId }, now + 1);
  assert.equal(await restarted.get({ kind: 'account', userId: account.userId }), null);
  const scheduled = await restarted.schedule({ kind: 'account', userId: account.userId }, now + 2);
  await restarted.purgeDue(now + RECOVERY_MS - 1);
  assert.ok((await sql(`SELECT id FROM ${tables.room.name} WHERE id=?`, [roomId])).rows.length);
  // Expiry cleanup must retain participant identities before removing immutable room versions.
  await sql(`UPDATE ${deletionTable.name} SET targets=[] WHERE user_id=?`, [account.userId]);
  await restarted.retainTargetsBeforeRoomCleanup();
  await sql(`REFRESH TABLE ${deletionTable.name}`);
  assert.deepEqual((await sql(`SELECT targets FROM ${deletionTable.name} WHERE user_id=?`, [account.userId])).rows, [[[{ roomId, participantId: guest.credential.participantId }]]]);
  await sql(`DELETE FROM ${tables.participant.name} WHERE room_id=?`, [roomId]);
  now = scheduled.purgeAfter;
  await Promise.all([restarted.purgeDue(now), new SqlDeletionStore(sql, secret).purgeDue(now)]);
  assert.equal(await restarted.get({ kind: 'account', userId: account.userId }), null);
  await sql(`REFRESH TABLE ${tables.participant.name},${accountHistoryTable.name},${accountIndexTable.name}`);
  assert.deepEqual((await sql(`SELECT id FROM ${tables.room.name} WHERE id=?`, [roomId])).rows, []);
  assert.deepEqual((await sql(`SELECT participant_id FROM ${tables.participant.name} WHERE member_user_id=?`, [account.userId])).rows, []);
  assert.deepEqual(await repo.accountStore.rooms(account.userId), []);
  assert.deepEqual(await repo.accountStore.history(account.userId), []);
  const peer = await repo.accountStore.history(peerId);
  assert.equal(peer.length, 1);
  assert.deepEqual(peer[0].people, ['Mia']);
  assert.equal(peer[0].title, 'A movie');
  assert.equal(peer[0].roomLabel, 'Past room');
});

test('real Crate deletion also erases a decision published from a room head while the purge was running', { skip: !origin }, async () => {
  assert.equal(new URL(origin!).port, '15871', 'This proof is restricted to its dedicated disposable database');
  const raw = crateSql(origin!, 'crate', '');
  const secret = 'disposable-deletion-proof-secret-at-least-thirty-two';
  await provisionRelationalRooms(raw, 0);
  const runId = randomBytes(8).toString('hex');
  let now = Date.now();
  const repo = new RelationalProposalRepository(raw, secret);
  const service = new ProposalService(repo, proposalFixtureCatalog, secret, async () => {}, () => now);
  const account = { userId: `late-alex-${runId}`, sessionId: `late-device-${runId}`, expiresAt: now + 90 * 86400_000 };
  const admission = await service.create({ contractVersion: 3 as const, commandId: randomBytes(16).toString('hex'), admissionSecret: randomBytes(32).toString('base64url'), nickname: 'Alex' }, account);
  const roomId = admission.credential.roomId;
  const participantId = admission.credential.participantId;
  const scheduled = await service.deleteAccount(account);
  // A publisher that read the head before the purge removed it inserts its decision after the purge's first history pass.
  const late = { id: `late-decision-${runId}`, roomId, roomLabel: 'Alex’s room', title: 'A movie', year: 2026, posterUrl: null, decidedAt: now, people: ['Alex', 'Mia'], participantIds: [participantId, 'mia'], accountIds: [account.userId, `late-mia-${runId}`] };
  let published = false;
  const sql: typeof raw = async (stmt, args) => {
    const result = await raw(stmt, args);
    if (!published && stmt.startsWith(`DELETE FROM ${tables.room.name} `)) {
      published = true;
      await repo.accountStore.publish([late]);
    }
    return result;
  };
  now = scheduled.purgeAfter + 1;
  // The room must have expired before a purge erases it.
  await raw(`UPDATE ${tables.room.name} SET expires_at=? WHERE id=?`, [now - 1, roomId]);
  await raw(`REFRESH TABLE ${Object.values(tables).map(t => t.name).join(',')}`);
  for (const t of Object.values(tables).filter(t => t !== tables.room)) await raw(`UPDATE ${t.name} SET expires_at=? WHERE room_id=?`, [now - 1, roomId]);
  await new SqlDeletionStore(sql, secret).purgeDue(now);
  assert.ok(published, 'the late publication happened during the purge');
  assert.deepEqual((await raw(`SELECT id FROM ${tables.room.name} WHERE id=?`, [roomId])).rows, []);
  await raw(`REFRESH TABLE ${accountHistoryTable.name}`);
  const [row] = (await raw(`SELECT people,participant_ids,account_ids,room_label FROM ${accountHistoryTable.name} WHERE id=?`, [late.id])).rows;
  assert.deepEqual(row, [['Mia'], ['mia'], [`late-mia-${runId}`], 'Past room']);
});

test('real Crate purge: requests whose erasure keeps failing back off and never strand a later request', { skip: !origin, timeout: 240000 }, async () => {
  assert.equal(new URL(origin!).port, '15871', 'This proof is restricted to its dedicated disposable database');
  const sql = crateSql(origin!, 'crate', '');
  const secret = 'disposable-deletion-proof-secret-at-least-thirty-two';
  await provisionRelationalRooms(sql, 0);
  const runId = randomBytes(8).toString('hex');
  const repo = new RelationalProposalRepository(sql, secret);
  const service = new ProposalService(repo, proposalFixtureCatalog, secret);
  const store = new SqlDeletionStore(sql, secret);
  const admit = async (userId: string) => (await service.create({ contractVersion: 3 as const, commandId: randomBytes(16).toString('hex'), admissionSecret: randomBytes(32).toString('base64url'), nickname: 'Alex' }, { userId, sessionId: `${userId}-device`, expiresAt: Date.now() + 86400_000 })).credential.roomId;
  // More stuck requests than one purge takes (20), all due before the healthy one.
  const stuck = Array.from({ length: 21 }, (_, i) => `stuck-${i}-${runId}`);
  const stuckRooms: string[] = [];
  for (const userId of stuck) stuckRooms.push(await admit(userId));
  const healthy = `healthy-${runId}`;
  const healthyRoom = await admit(healthy);
  const start = Date.now();
  for (const [i, userId] of stuck.entries()) await store.schedule({ kind: 'account', userId }, start + i);
  const scheduled = await store.schedule({ kind: 'account', userId: healthy }, start + 1000);
  const now = scheduled.purgeAfter;
  // Their rooms are still active at purge time, so every erasure of theirs fails; the healthy room has long expired.
  for (const id of stuckRooms) await sql(`UPDATE ${tables.room.name} SET expires_at=? WHERE id=?`, [now + 86400_000, id]);
  await sql(`REFRESH TABLE ${tables.room.name}`);

  const stillActive = (count: number) => (e: unknown) => {
    const errors: unknown[] = (e as { errors?: unknown[] }).errors ?? [e];
    return errors.length === count && errors.every(x => /still active/.test((x as Error).message));
  };
  await assert.rejects(store.purgeDue(now), stillActive(20), 'each of the first window fails on its own');
  assert.ok(await store.get({ kind: 'account', userId: healthy }), 'the first window is all stuck requests');
  await assert.rejects(store.purgeDue(now), stillActive(1));
  assert.equal(await store.get({ kind: 'account', userId: healthy }), null, 'the later request is erased');
  assert.deepEqual((await sql(`SELECT id FROM ${tables.room.name} WHERE id=?`, [healthyRoom])).rows, []);
  await sql(`REFRESH TABLE ${tables.participant.name}`);
  assert.deepEqual((await sql(`SELECT participant_id FROM ${tables.participant.name} WHERE member_user_id=?`, [healthy])).rows, []);
  // Every stuck request keeps its marker, leased out for its backoff: the next purge does not claim them again.
  for (const userId of stuck) assert.equal((await store.get({ kind: 'account', userId }))?.phase, 'purging');
  await store.purgeDue(now);
  await sql(`REFRESH TABLE ${deletionTable.name}`);
  const leases = (await sql(`SELECT lease_until FROM ${deletionTable.name} WHERE user_id=ANY(?)`, [stuck])).rows.map(r => Number(r[0]));
  assert.equal(leases.length, 21);
  for (const lease of leases) assert.ok(lease > now && lease <= now + 3 * 60_000, `backed off until ${lease - now} ms after now`);
  for (const id of stuckRooms) assert.ok((await sql(`SELECT id FROM ${tables.room.name} WHERE id=?`, [id])).rows.length, 'active rooms stay');
  await sql(`DELETE FROM ${deletionTable.name} WHERE user_id=ANY(?)`, [stuck]);
});
