import { randomInt } from "node:crypto"
import { timed, timedSync } from "./server-timing.ts"
import { codec } from "./crypto.server.ts"
import { RoomError } from "./errors.ts"
import type { RelationalProposalRepository } from "./proposal-relational-repository.ts"
import type { DeletionStore } from "./proposal-deletion.ts"
import type { AccountRoomsStore, ProposalRepository, ProposalRoom, ProposalStored } from "./proposal-types.ts"
import { K, readCall, script, writeCall, type RoomsValkey } from "./proposal-rooms-valkey.ts"

/** How long invite mappings stay after their room expired: as long as Crate keeps them (retention), plus a week. */
export const INVITE_KEEP_MS = (retentionDays: number) => (retentionDays + 7) * 86400_000
const fail = () => new RoomError("busy", "Stored room is incomplete or incompatible", 503, true)
/** A fresh incarnation: the compare-and-swap term, never reused by a room imported or replaced again. */
export const incarnation = () => randomInt(1, 2 ** 47)

export interface ValkeyRoomOptions {
	accounts: AccountRoomsStore
	deletions: DeletionStore
	retentionDays: number
	now?: () => number
	/** Told after every commit, so the history copy starts at once (the job itself is already queued). */
	onCommit?: (roomId: string) => void
}

/**
 * Live rooms in the dedicated Valkey (docs/yepwatch-valkey-rooms.md). The service's read → transition →
 * compare-and-swap loops are unchanged: `seq` is the room's version (+1 per commit) and `term` its incarnation.
 * Each commit queues the room for the Crate history copy (proposal-history-sync.ts) in the same script. Until the
 * live Crate rooms were imported (`{yw}:mirror` rooms), a missing room is read through from Crate and imported.
 */
export class ValkeyRoomRepository implements ProposalRepository {
	readonly accountStore: AccountRoomsStore
	readonly deletionStore: DeletionStore
	readonly crate: RelationalProposalRepository
	private redis: RoomsValkey
	private crypto: ReturnType<typeof codec>
	private now: () => number
	private onCommit: (roomId: string) => void
	private inviteKeepMs: number
	constructor(redis: RoomsValkey, crate: RelationalProposalRepository, secret: string, options: ValkeyRoomOptions) {
		this.redis = redis
		this.crate = crate
		this.crypto = codec(`${secret}\0yepwatch-live-room`)
		this.accountStore = options.accounts
		this.deletionStore = options.deletions
		this.now = options.now ?? Date.now
		this.onCommit = options.onCommit ?? (() => {})
		this.inviteKeepMs = INVITE_KEEP_MS(options.retentionDays)
	}
	/** The room as stored: JSON sealed with the room key (it holds member grants and sign-in verifiers). */
	encode(room: ProposalRoom) {
		return this.crypto.encode(room, room.id)
	}
	decode(id: string, body: string): ProposalRoom {
		let room: ProposalRoom
		try {
			room = this.crypto.decode<ProposalRoom>(body, id)
		} catch {
			throw fail()
		}
		if (room?.id !== id) throw fail()
		return room
	}
	async read(id: string): Promise<ProposalStored | null> {
		const f = await readCall(script<(string | null)[]>(this.redis, "ywRead", K.room(id), K.mirror))
		if (f[0] === null) return f[1] === "1" ? null : this.readThrough(id)
		return { room: this.decode(id, f[3]!), seq: Number(f[0]), term: Number(f[1]), pendingRevision: Number(f[2]) }
	}
	/** Before the live Crate rooms were imported: Crate's head, imported unless a write got there first. */
	private async readThrough(id: string): Promise<ProposalStored | null> {
		const stored = await timed("crate", this.crate.read(id))
		if (!stored) return null
		await this.import(stored)
		const f = await readCall(script<(string | null)[]>(this.redis, "ywRead", K.room(id), K.mirror))
		if (f[0] === null) throw fail()
		return { room: this.decode(id, f[3]!), seq: Number(f[0]), term: Number(f[1]), pendingRevision: Number(f[2]) }
	}
	/** Imports a room read from Crate (synced at its head), unless the live store has it. True when imported. */
	async import(stored: ProposalStored) {
		const { room } = stored
		return (
			Number(
				await writeCall(
					script(
						this.redis,
						"ywImport",
						K.room(room.id),
						K.pending,
						this.now(),
						incarnation(),
						room.revision,
						room.expiresAt,
						stored.pendingRevision,
						room.agreement.state === "checking" ? 1 : 0,
						this.encode(room),
						room.id,
						stored.seq,
						stored.term
					)
				)
			) === 1
		)
	}
	async insert(room: ProposalRoom) {
		timedSync("plan", () => this.crate.validate(room))
		const result = Number(
			await writeCall(
				script(
					this.redis,
					"ywInsert",
					K.room(room.id),
					K.pending,
					K.jobs,
					this.now(),
					incarnation(),
					room.revision,
					room.expiresAt,
					room.revision,
					room.agreement.state === "checking" ? 1 : 0,
					this.encode(room),
					room.id
				)
			)
		)
		if (result === -1) throw new RoomError("expired", "Room expired", 410)
		if (result === 1) this.onCommit(room.id)
		return result === 1
	}
	async compareAndSwap(previous: ProposalStored, room: ProposalRoom, notify: boolean) {
		if (previous.room.id !== room.id || room.revision < previous.room.revision) throw fail()
		timedSync("plan", () => this.crate.validate(room))
		const pendingRevision = notify ? Math.max(previous.pendingRevision, room.revision) : previous.pendingRevision
		const result = Number(
			await writeCall(
				script(
					this.redis,
					"ywCas",
					K.room(room.id),
					K.pending,
					K.jobs,
					this.now(),
					previous.seq,
					previous.term,
					room.revision,
					pendingRevision,
					room.agreement.state === "checking" ? 1 : 0,
					this.encode(room),
					room.id
				)
			)
		)
		if (result === 1) this.onCommit(room.id)
		return result === 1
	}
	async pending(limit: number) {
		return readCall(script<string[]>(this.redis, "ywPending", K.pending, Math.min(100, limit), K.room("")))
	}
	async acknowledge(id: string, revision: number) {
		await writeCall(script(this.redis, "ywAck", K.room(id), K.pending, revision, id))
	}
	async rememberInvite(hash: string, roomId: string, expiresAt: number) {
		const result = Number(
			await writeCall(
				script(this.redis, "ywInvite", K.invite(hash), K.mirror, roomId, expiresAt, expiresAt + this.inviteKeepMs)
			)
		)
		// Invites not imported yet (a fresh or lost store): Crate decides, as before; the import copies it later.
		if (result === -2) return this.crate.rememberInvite(hash, roomId, expiresAt)
		return result === -1 ? null : result
	}
	async findInvite(hash: string) {
		const found = await readCall(script<string | null>(this.redis, "ywFindInvite", K.invite(hash), K.mirror))
		if (found === null) return this.crate.findInvite(hash)
		return found || null
	}
	/** A search over the history copy (it lags commits by milliseconds); callers read each room here. */
	stalePendingIdeas(leaseBefore: number, now: number, limit: number, after?: string) {
		return this.crate.stalePendingIdeas(leaseBefore, now, limit, after)
	}
}
