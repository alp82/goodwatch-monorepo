import type { RoomPosterPreview } from "../../../packages/yepwatch-contracts/proposal.ts"
import type { ProposalCatalog, ProposalRoom } from "./proposal-types.ts"
import { activeRoom } from "./proposal-context.ts"
import { deckInputs } from "./proposal-prepared-decks.ts"
import { RoomError } from "./errors.ts"
import type { PreparedDecks } from "./proposal-prepared-decks.ts"
import { projectedCandidate } from "./proposal-machine.ts"

/** Process-local, bounded, single-flight read cache. No room writes, jobs, or interpretation. */
export class PosterPreviews {
	private entries = new Map<string, { until: number; result: Promise<RoomPosterPreview> }>()
	private running = 0
	private catalog: ProposalCatalog
	private now: () => number
	private decks?: PreparedDecks
	constructor(catalog: ProposalCatalog, now: () => number = Date.now, decks?: PreparedDecks) {
		this.decks = decks
		this.catalog = catalog
		this.now = now
	}

	async read(source: ProposalRoom): Promise<RoomPosterPreview> {
		const empty = { candidates: [] }
		if (source.phase !== "setup") return empty
		const room = structuredClone(activeRoom(source))
		if (!room.screens.some((s) => s.confirmed && s.country && s.serviceIds.length)) return empty
		// Saved continuation lookup requires fresh account progress; setup only previews movies/new shows.
		if (room.constraints.kinds.includes("show_continue")) return empty
		room.ideas = (room.ideas ?? []).filter((i) => i.on)
		const prepared = this.decks?.peek(source)
		if (prepared) return { candidates: prepared.candidates.slice(0, 5).map(projectedCandidate) }
		const key = deckInputs(room) + (this.catalog.inputRevision?.(room) ?? "")
		let held = this.entries.get(key)
		if (!held || held.until <= this.now()) {
			if (this.running >= 4) throw unavailable()
			this.running++
			const entry = {
				until: Infinity,
				result: Promise.resolve(empty) as Promise<RoomPosterPreview>,
			}
			entry.result = Promise.resolve()
				.then(() => this.catalog.page(room, { limit: 5, preview: true }))
				.then((page) => {
					entry.until = this.now() + 10_000
					return { candidates: page.candidates.slice(0, 5).map(projectedCandidate) }
				})
				.catch(() => {
					if (this.entries.get(key) === entry) this.entries.delete(key)
					throw unavailable()
				})
				.finally(() => {
					this.running--
				})
			this.entries.delete(key)
			this.entries.set(key, entry)
			while (this.entries.size > 256) this.entries.delete(this.entries.keys().next().value!)
			held = entry
		}
		let timer: ReturnType<typeof setTimeout> | undefined
		try {
			return structuredClone(
				await Promise.race([
					held.result,
					new Promise<RoomPosterPreview>((_resolve, reject) => {
						timer = setTimeout(() => reject(unavailable()), 800)
					}),
				]),
			)
		} finally {
			clearTimeout(timer)
		}
	}
}

const unavailable = () =>
	new RoomError("catalog_unavailable", "Poster preview is temporarily unavailable", 503, true)
