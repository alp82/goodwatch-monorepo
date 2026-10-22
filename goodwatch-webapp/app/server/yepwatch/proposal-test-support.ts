import { continuousFixtureCatalog } from "./continuous-test-support.ts"
import type {
	ProposalRepository,
	ProposalRoom,
	ProposalStored,
	ProposalCatalog,
} from "./proposal-types.ts"
import { IndeterminateWrite } from "./errors.ts"

export class ProposalMemoryRepository implements ProposalRepository {
	rows = new Map<string, ProposalStored>()
	ambiguousNext = false
	async read(id: string) {
		return structuredClone(this.rows.get(id) ?? null)
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
