import { keyed, hash, random } from './crypto.server.ts';
import { RoomError } from './errors.ts';
import { z } from 'zod';
import type { Sql } from './repository.server.ts';
import { deletionTable, accountIndexTable, accountHistoryTable, tables, invitationTable, tableDdl } from './proposal-storage-schema.ts';

export const RECOVERY_MS = 30 * 86400_000;
export type DeletionSubject = { kind: 'account'; userId: string } | { kind: 'guest'; roomId: string; participantId: string };
export interface DeletionState { requestedAt: number; purgeAfter: number; phase: 'pending' | 'purging'; recoveryId: string }
export interface DeletionEntry extends DeletionState { id: string; subject: DeletionSubject }
export interface DeletionStore {
  get(subject: DeletionSubject): Promise<DeletionState | null>;
  schedule(subject: DeletionSubject, now: number): Promise<DeletionState>;
  restore(subject: DeletionSubject, now: number): Promise<void>;
  purgeDue(now: number): Promise<void>;
}
const unavailable = () => new RoomError('forbidden', 'YepWatch deletion is in progress. Open Delete account to restore your data before the recovery deadline.', 403);
export async function requireNotDeleting(store: DeletionStore, subject: DeletionSubject) {
  if (await store.get(subject)) throw unavailable();
}
const subjectKey = (s: DeletionSubject) => s.kind === 'account' ? `account:${s.userId}` : `guest:${s.roomId}:${s.participantId}`;
const phaseSchema = z.enum(['pending', 'purging']);
const targetSchema = z.object({ roomId: z.string(), participantId: z.string() });
const pairSchema = z.tuple([z.string(), z.string()]);
const historySchema = z.tuple([z.string(), z.array(z.string()), z.array(z.string()), z.array(z.string()), z.number(), z.number()]);
export class MemoryDeletionStore implements DeletionStore {
  readonly entries = new Map<string, DeletionEntry>();
  private purge: (subject: DeletionSubject, now: number) => Promise<void>;
  constructor(purge: (subject: DeletionSubject, now: number) => Promise<void> = async () => {}) { this.purge = purge; }
  async get(subject: DeletionSubject) { const entry = this.entries.get(subjectKey(subject)); return entry ? { requestedAt: entry.requestedAt, purgeAfter: entry.purgeAfter, phase: entry.phase, recoveryId: entry.recoveryId } : null; }
  async schedule(subject: DeletionSubject, now: number) {
    const key = subjectKey(subject);
    if (!this.entries.has(key)) this.entries.set(key, { id: key, subject, requestedAt: now, purgeAfter: now + RECOVERY_MS, phase: 'pending', recoveryId: hash(`${key}:${now}`) });
    return (await this.get(subject))!;
  }
  async restore(subject: DeletionSubject, now: number) {
    const old = this.entries.get(subjectKey(subject));
    if (old && (old.phase !== 'pending' || old.purgeAfter <= now)) throw unavailable();
    this.entries.delete(subjectKey(subject));
  }
  async purgeDue(now: number) {
    const errors: unknown[] = [];
    for (const [key, entry] of this.entries) if (entry.purgeAfter <= now) {
      entry.phase = 'purging';
      try {
        await this.purge(entry.subject, now);
        this.entries.delete(key);
      } catch (error) {
        errors.push(error);
      }
    }
    settled(errors);
  }
}

/** One failing request never stops the others; the caller still learns that something will retry. */
function settled(errors: unknown[]) {
  if (errors.length === 1) throw errors[0];
  if (errors.length) throw Object.assign(new Error('Some YepWatch deletions will retry'), { errors });
}
/**
 * A request whose erasure failed waits 2, 4, … up to 60 minutes before it is claimed again. The wait itself is the
 * request's persisted lease_until, so every instance, and this one after a restart, honours it: no request is retried
 * before its deadline. Only the escalation is per instance: the failure count lives in memory (the deletion table has no
 * column for it, and adding one is DDL), so a restart, or another instance claiming the request, starts again at 2
 * minutes. That retries a persistently failing request more often than the cap allows, never earlier than its deadline.
 */
const MAX_RETRY_MS = 60 * 60_000;
const REMEMBERED_FAILURES = 1000;

export async function provisionDeletion(sql: Sql, replicas: 0 | 2) { await sql(tableDdl(deletionTable, replicas)); }

/** Lifecycle writes use primary-key OCC. A purge claim wins against restoration before erasure begins. */
export class SqlDeletionStore implements DeletionStore {
  private sql: Sql;
  private secret: string;
  /** Failures per request seen by this instance, for the backoff escalation only (see MAX_RETRY_MS). */
  private failures = new Map<string, number>();
  constructor(sql: Sql, secret: string) { this.sql = sql; this.secret = secret; }
  id(subject: DeletionSubject) { return keyed(this.secret, 'deletion', subjectKey(subject)); }
  /** The state get() answers for a stored row: the live store's copy builds the same one. */
  state(id: string, requestedAt: number, purgeAfter: number, phase: DeletionState['phase']): DeletionState {
    return { requestedAt, purgeAfter, phase, recoveryId: keyed(this.secret, 'deletion-recovery', `${id}:${requestedAt}`) };
  }
  /** Whether a request with this stored id exists (primary-key read, real time). */
  async exists(id: string) { return (await this.sql(`SELECT id FROM ${deletionTable.name} WHERE id=?`, [id])).rows.length > 0; }
  /** Every deletion request (id, times, phase), for the live store's copy. Refreshed first: requests are few. */
  async entries() {
    await this.sql(`REFRESH TABLE ${deletionTable.name}`);
    return (await this.sql(`SELECT id,requested_at,purge_after,phase FROM ${deletionTable.name} LIMIT 100000`)).rows.map(r => {
      const [id, requestedAt, purgeAfter, phase] = z.tuple([z.string(), z.number(), z.number(), phaseSchema]).parse(r);
      return { id, requestedAt, purgeAfter, phase };
    });
  }
  private async row(subject: DeletionSubject) {
    const row = (await this.sql(`SELECT requested_at,purge_after,phase,_seq_no,_primary_term,lease_until,purge_token FROM ${deletionTable.name} WHERE id=?`, [this.id(subject)])).rows[0];
    return row ? z.tuple([z.number(), z.number(), phaseSchema, z.number(), z.number(), z.number(), z.string().nullable()]).parse(row) : null;
  }
  async get(subject: DeletionSubject): Promise<DeletionState | null> {
    const r = await this.row(subject);
    return r ? this.state(this.id(subject), Number(r[0]), Number(r[1]), r[2]) : null;
  }
  async schedule(subject: DeletionSubject, now: number) {
    // An uncertain insert is reconciled by the immutable primary-key read; retry never extends the grace period.
    try {
      await this.sql(`REFRESH TABLE ${tables.participant.name}`);
      const targets = subject.kind === 'account'
        ? (await this.sql(`SELECT DISTINCT room_id,participant_id FROM ${tables.participant.name} WHERE member_user_id=?`, [subject.userId])).rows.map(r => { const [roomId, participantId] = pairSchema.parse(r); return { roomId, participantId }; })
        : [{ roomId: subject.roomId, participantId: subject.participantId }];
      await this.sql(`INSERT INTO ${deletionTable.name} (id,kind,user_id,room_id,participant_id,requested_at,purge_after,phase,targets,lease_until,purge_token) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING`,
        [this.id(subject), subject.kind, subject.kind === 'account' ? subject.userId : null, subject.kind === 'guest' ? subject.roomId : null,
          subject.kind === 'guest' ? subject.participantId : null, now, now + RECOVERY_MS, 'pending', targets, 0, null]);
    } catch (error) {
      if (!(await this.get(subject))) throw error;
    }
    const proof = await this.get(subject);
    if (!proof) throw new RoomError('busy', 'Deletion has not been confirmed. Retry the same request.', 503, true);
    return proof;
  }
  async restore(subject: DeletionSubject, now: number) {
    for (let i = 0; i < 8; i++) {
      const r = await this.row(subject);
      if (!r) return;
      if (r[2] !== 'pending' || Number(r[1]) <= now) throw unavailable();
      if ((await this.sql(`DELETE FROM ${deletionTable.name} WHERE id=? AND _seq_no=? AND _primary_term=?`, [this.id(subject), r[3], r[4]])).rowcount === 1) return;
    }
    throw new RoomError('busy', 'Restoration has not been confirmed. Retry shortly.', 503, true);
  }
  /** Before quiesced room expiry cleanup, retain identities from any admission that overlapped deletion. */
  async retainTargetsBeforeRoomCleanup() {
    await this.sql(`REFRESH TABLE ${deletionTable.name},${tables.participant.name}`);
    let cursor = '';
    for (;;) {
      const rows = (await this.sql(`SELECT id,user_id,targets,_seq_no,_primary_term FROM ${deletionTable.name} WHERE kind='account' AND id>? ORDER BY id LIMIT 100`, [cursor])).rows.map(r =>
        z.tuple([z.string(), z.string(), z.array(targetSchema), z.number(), z.number()]).parse(r));
      if (!rows.length) return;
      for (const row of rows) {
        const found = (await this.sql(`SELECT DISTINCT room_id,participant_id FROM ${tables.participant.name} WHERE member_user_id=?`, [row[1]])).rows.map(r => {
          const [roomId, participantId] = pairSchema.parse(r); return { roomId, participantId };
        });
        const targets = [...new Map([...row[2], ...found].map(t => [`${t.roomId}:${t.participantId}`, t])).values()];
        if (targets.length > 10000) throw new Error('Deletion target limit reached; preserve room records');
        if ((await this.sql(`UPDATE ${deletionTable.name} SET targets=? WHERE id=? AND _seq_no=? AND _primary_term=?`, [targets, row[0], row[3], row[4]])).rowcount !== 1)
          throw new Error('Deletion changed; retry room cleanup before removing any records');
      }
      cursor = rows[rows.length - 1][0];
    }
  }
  /**
   * Erases up to 20 due requests, earliest first. A request whose erasure fails keeps its marker and is leased out for
   * a growing backoff (persisted as its lease; the growth is per instance, see MAX_RETRY_MS), so it leaves the window and later requests are reached; the others still run, and the call
   * rejects afterwards so the caller knows something will retry.
   */
  async purgeDue(now: number) {
    await this.sql(`REFRESH TABLE ${deletionTable.name}`);
    const due = (await this.sql(`SELECT id,kind,user_id,room_id,participant_id,phase,_seq_no,_primary_term,targets,lease_until FROM ${deletionTable.name} WHERE purge_after<=? AND lease_until<=? ORDER BY purge_after LIMIT 20`, [now, now])).rows.map(r =>
      z.tuple([z.string(), z.enum(['account', 'guest']), z.string().nullable(), z.string().nullable(), z.string().nullable(), phaseSchema, z.number(), z.number(), z.array(targetSchema), z.number()]).parse(r));
    const errors: unknown[] = [];
    for (const r of due) {
      if (r[9] > now) continue;
      const token = random();
      const started = Date.now();
      const clock = () => now + Date.now() - started;
      if ((await this.sql(`UPDATE ${deletionTable.name} SET phase='purging',lease_until=?,purge_token=? WHERE id=? AND _seq_no=? AND _primary_term=?`, [clock() + 300_000, token, r[0], r[6], r[7]])).rowcount !== 1) continue;
      const subject: DeletionSubject = r[1] === 'account' ? { kind: 'account', userId: z.string().parse(r[2]) } : { kind: 'guest', roomId: z.string().parse(r[3]), participantId: z.string().parse(r[4]) };
      const heartbeat = async () => {
        const proof = await this.row(subject);
        if (!proof || proof[6] !== token || proof[2] !== 'purging' || proof[5] <= clock()) throw new RoomError('busy', 'Deletion lease changed; retry later.', 503, true);
        if ((await this.sql(`UPDATE ${deletionTable.name} SET lease_until=? WHERE id=? AND _seq_no=? AND _primary_term=?`, [clock() + 300_000, r[0], proof[3], proof[4]])).rowcount !== 1) throw new RoomError('busy', 'Deletion lease changed.', 503, true);
      };
      try {
        await this.erase(subject, now, r[8], heartbeat);
        const proof = await this.row(subject);
        if (proof?.[6] === token) await this.sql(`DELETE FROM ${deletionTable.name} WHERE id=? AND _seq_no=? AND _primary_term=?`, [r[0], proof[3], proof[4]]);
        this.failures.delete(r[0]);
      } catch (error) {
        errors.push(error);
        const failures = (this.failures.get(r[0]) ?? 0) + 1;
        this.failures.delete(r[0]);
        this.failures.set(r[0], failures);
        if (this.failures.size > REMEMBERED_FAILURES) this.failures.delete(this.failures.keys().next().value!);
        try {
          const proof = await this.row(subject);
          if (proof?.[6] === token) await this.sql(`UPDATE ${deletionTable.name} SET lease_until=? WHERE id=? AND _seq_no=? AND _primary_term=?`, [clock() + Math.min(2 ** failures * 60_000, MAX_RETRY_MS), r[0], proof[3], proof[4]]);
        } catch (release) {
          // The claim's own lease still expires; the request is retried then.
          errors.push(release);
        }
      }
    }
    settled(errors);
  }
  private async erase(subject: DeletionSubject, now: number, targets: { roomId: string; participantId: string }[], heartbeat: () => Promise<void>) {
    await heartbeat();
    await this.sql(`REFRESH TABLE ${tables.participant.name}`);
    const related: [string, string][] = subject.kind === 'account'
      ? (await this.sql(`SELECT DISTINCT room_id,participant_id FROM ${tables.participant.name} WHERE member_user_id=?`, [subject.userId])).rows.map(r => pairSchema.parse(r))
      : [[subject.roomId, subject.participantId]];
    related.push(...targets.map(t => pairSchema.parse([t.roomId, t.participantId])));
    const participants = new Set<string>(related.map(r => r[1]));
    // Personal names are removed from shared durable history while other people's chosen titles survive.
    const filters = [...(subject.kind === 'account' ? ['?=ANY(account_ids)'] : []), ...[...participants].map(() => '?=ANY(participant_ids)')];
    const identities = [...(subject.kind === 'account' ? [subject.userId] : []), ...participants];
    const scrub = async () => {
      await this.sql(`REFRESH TABLE ${accountHistoryTable.name}`);
      let cursor = '';
      for (; filters.length;) {
        await heartbeat();
        const rows = (await this.sql(`SELECT id,people,participant_ids,account_ids,_seq_no,_primary_term FROM ${accountHistoryTable.name} WHERE id>? AND (${filters.join(' OR ')}) ORDER BY id LIMIT 100`, [cursor, ...identities])).rows.map(r => historySchema.parse(r));
        if (!rows.length) break;
        for (const row of rows) {
          const affected = row[2].some((id: string) => participants.has(id)) || (subject.kind === 'account' && row[3].includes(subject.userId));
          if (!affected) continue;
          const keep = row[2].map((id: string, i: number) => participants.has(id) ? -1 : i).filter((i: number) => i >= 0);
          const accounts = subject.kind === 'account' ? row[3].filter((id: string) => id !== subject.userId) : row[3];
          const result = await this.sql(`UPDATE ${accountHistoryTable.name} SET people=?,participant_ids=?,account_ids=?,room_label=? WHERE id=? AND _seq_no=? AND _primary_term=?`,
            [keep.map((i: number) => row[1][i]), keep.map((i: number) => row[2][i]), accounts, 'Past room', row[0], row[4], row[5]]);
          if (result.rowcount !== 1) throw new RoomError('busy', 'History deletion will retry.', 503, true);
        }
        cursor = rows[rows.length - 1][0];
      }
    };
    await scrub();
    // No live room versions are reclaimed. Every associated room must have expired before any row is erased.
    const roomIds = [...new Set<string>(related.map(r => r[0]))];
    for (const id of roomIds) {
      await heartbeat();
      const head = (await this.sql(`SELECT expires_at FROM ${tables.room.name} WHERE id=?`, [id])).rows[0];
      if (head && Number(head[0]) > now) throw new RoomError('busy', 'A room is still active; deletion will retry.', 503, true);
    }
    // The bulk expiry predicates use Crate search visibility, unlike the primary-key checks above.
    if (roomIds.length) await this.sql(`REFRESH TABLE ${[...Object.values(tables), invitationTable].map(t => t.name).join(',')}`);
    for (const id of roomIds) {
      await heartbeat();
      for (const table of Object.values(tables).filter(t => t !== tables.room)) await this.sql(`DELETE FROM ${table.name} WHERE room_id=? AND expires_at<=?`, [id, now]);
      await this.sql(`DELETE FROM ${invitationTable.name} WHERE room_id=? AND expires_at<=?`, [id, now]);
      await this.sql(`DELETE FROM ${tables.room.name} WHERE id=? AND expires_at<=?`, [id, now]);
      if ((await this.sql(`SELECT id FROM ${tables.room.name} WHERE id=?`, [id])).rows.length) throw new RoomError('busy', 'Room deletion will retry.', 503, true);
    }
    // A publisher (notify, repair, room retention) that read a head before it went may have inserted a decision after
    // the first pass. With the heads gone no new one can start, so a second pass catches all but a publication still in
    // flight at this moment (see docs/adr/yepwatch-account-deletion.md).
    if (roomIds.length) await scrub();
    await heartbeat();
    if (subject.kind === 'account') await this.sql(`DELETE FROM ${accountIndexTable.name} WHERE id=?`, [keyed(this.secret, 'account-rooms', subject.userId)]);
  }
}
