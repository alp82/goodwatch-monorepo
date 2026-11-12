import { MemoryAccountRooms } from "./proposal-account-store.ts"
import { ideaPending } from "../../../packages/yepwatch-contracts/proposal.ts"
import { continuousFixtureCatalog } from "./continuous-test-support.ts"
import type {
	ProposalRepository,
	ProposalRoom,
	ProposalStored,
	ProposalCatalog,
} from "./proposal-types.ts"
import { IndeterminateWrite, RoomError } from "./errors.ts"
import { CONTINUOUS_LIMITS } from "./continuous-types.ts"
import { allowanceFull, type CreationQuotaStore } from "./proposal-creation-quota.ts"

/** Per-person room allowances in memory, on the caller's clock: the reservation rules of SqlCreationQuotas. */
export class MemoryCreationQuotas implements CreationQuotaStore {
	readonly limit: number
	readonly rooms = new Map<string, { creator: string; admission: string; expiresAt: number }>()
	private now: () => number
	constructor(now: () => number = Date.now, limit = 10) {
		this.now = now
		this.limit = limit
	}
	async eligible(roomId: string, admissionDigest: string, creatorDigest: string) {
		const prior = this.rooms.get(roomId)
		if (prior && prior.expiresAt > this.now()) {
			if (prior.admission !== admissionDigest) throw new RoomError("conflict", "Admission retry changed", 409)
			return
		}
		const live = [...this.rooms.values()].filter((r) => r.creator === creatorDigest && r.expiresAt > this.now())
		if (live.length >= this.limit) throw allowanceFull(this.limit)
	}
	async reserve(roomId: string, admissionDigest: string, creatorDigest: string) {
		const prior = this.rooms.get(roomId)
		if (prior && prior.expiresAt > this.now()) {
			if (prior.admission !== admissionDigest) throw new RoomError("conflict", "Admission retry changed", 409)
			return prior.expiresAt
		}
		const live = [...this.rooms.values()].filter((r) => r.creator === creatorDigest && r.expiresAt > this.now())
		if (live.length >= this.limit) throw allowanceFull(this.limit)
		const expiresAt = this.now() + CONTINUOUS_LIMITS.roomMs
		this.rooms.set(roomId, { creator: creatorDigest, admission: admissionDigest, expiresAt })
		return expiresAt
	}
	async active(roomId: string, expectedExpiry?: number) {
		const room = this.rooms.get(roomId)
		if (room && room.expiresAt <= this.now()) throw new RoomError("expired", "Room expired", 410)
		if (!room || (expectedExpiry !== undefined && expectedExpiry !== room.expiresAt))
			throw new RoomError("busy", "Room allowance could not be confirmed. Retry the same request.", 503, true)
	}
	async count() {
		return [...this.rooms.values()].filter((r) => r.expiresAt > this.now()).length
	}
}

export class ProposalMemoryRepository implements ProposalRepository {
	accountStore = new MemoryAccountRooms()
	rows = new Map<string, ProposalStored>()
	private invitations = new Map<string, { roomId: string; expiresAt: number }>()
	async rememberInvite(hash: string, roomId: string, _expiresAt: number) {
		const old = this.invitations.get(hash)
		if (old && old.roomId !== roomId) return null
		if (old) return old.expiresAt
		this.invitations.set(hash, { roomId, expiresAt: _expiresAt })
		return _expiresAt
	}
	async findInvite(hash: string) {
		return this.invitations.get(hash)?.roomId ?? null
	}
	ambiguousNext = false
	async read(id: string) {
		return structuredClone(this.rows.get(id) ?? null)
	}
	async stalePendingIdeas(leaseBefore: number, now: number, limit: number, after = "") {
		return [...this.rows.values()]
			.filter(({ room }) => room.id > after && room.expiresAt > now && (room.ideas ?? []).some((i) => ideaPending(i) && i.interpretedAt < leaseBefore))
			.map(({ room }) => room.id)
			.sort()
			.slice(0, limit)
	}
	async insert(room: ProposalRoom) {
		if (this.rows.has(room.id)) return false
		this.rows.set(room.id, {
			room: structuredClone(room),
			seq: 0,
			term: 1,
			pendingRevision: room.revision,
		})
		return true
	}
	async compareAndSwap(
		old: ProposalStored,
		room: ProposalRoom,
		notify: boolean
	) {
		const current = this.rows.get(room.id)
		if (!current || current.seq !== old.seq || current.term !== old.term)
			return false
		this.rows.set(room.id, {
			room: structuredClone(room),
			seq: old.seq + 1,
			term: old.term,
			pendingRevision: notify
				? Math.max(old.pendingRevision, room.revision)
				: old.pendingRevision,
		})
		if (this.ambiguousNext) {
			this.ambiguousNext = false
			throw new IndeterminateWrite("Injected lost ack")
		}
		return true
	}
	async pending(limit: number) {
		return [...this.rows.values()]
			.filter((s) => s.pendingRevision || s.room.agreement.state === "checking")
			.slice(0, limit)
			.map((s) => s.room.id)
	}
	async acknowledge(id: string, revision: number) {
		const s = this.rows.get(id)
		if (s && s.pendingRevision <= revision) s.pendingRevision = 0
	}
}
export const proposalFixtureCatalog: ProposalCatalog = {
	metadata: continuousFixtureCatalog.metadata,
	async page(room) {
		const page = await continuousFixtureCatalog.page(room)
		return {
			...page,
			candidates: page.candidates.map((c) => ({ ...c, viewingDuration: null })),
		}
	},
	async recheck(room, candidate) {
		return continuousFixtureCatalog.recheck(room, candidate)
	},
}
