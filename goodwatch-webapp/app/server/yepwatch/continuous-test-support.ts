import type {
	ContinuousRepository,
	ContinuousRoom,
	ContinuousStored,
	ContinuousCatalog,
} from "./continuous-types.ts"
import { IndeterminateWrite } from "./errors.ts"
import { catalogRoom } from "./continuous-catalog.ts"
import { fixtureCatalog } from "./test-support.ts"
export class ContinuousMemoryRepository implements ContinuousRepository {
	rows = new Map<string, ContinuousStored>()
	ambiguousNext = false
	async read(id: string) {
		return structuredClone(this.rows.get(id) ?? null)
	}
	async insert(room: ContinuousRoom) {
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
		old: ContinuousStored,
		room: ContinuousRoom,
		notify: boolean,
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
export const continuousFixtureCatalog: ContinuousCatalog = {
	metadata: fixtureCatalog.metadata,
	async page(room) {
		const known = new Set(room.seenKeys)
		const base = await fixtureCatalog.candidates(catalogRoom(room))
		return {
			candidates: base.filter(
				(c) =>
					!known.has(
						`${c.identity.kind === "movie" ? "movie" : "show"}_${c.identity.tmdbId}`,
					),
			),
			exhausted: true,
		}
	},
	async recheck(room, candidate) {
		return candidate.availability.filter((e) =>
			room.participants.some((p) => p.screenId === e.screenId),
		)
	},
}
