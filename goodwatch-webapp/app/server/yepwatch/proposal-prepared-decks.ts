import { createHash } from "node:crypto"
import { activeRoom } from "./proposal-context.ts"
import type { ProposalCatalog, ProposalRoom } from "./proposal-types.ts"

type Page = Awaited<ReturnType<ProposalCatalog["page"]>>
interface Entry {
	inputs: string
	page: Promise<Page>
	builtAt: number
}

// What a participant or the room carries that a catalog page never reads: commands, sessions, sockets, answers and
// names change these all the time during setup, and must not make a prepared deck look out of date.
// The roster and context versions count changes, not what changed: who is in the room and its screens are inputs below.
const ROOM_NOISE = ["revision", "tickets", "stream", "agreement", "interpretationCount", "history", "memberIntents", "expiresAt", "inviteHash", "hostId", "proposal", "proposalVersion", "decision", "intent", "rosterVersion", "contextVersion"] as const
const PARTICIPANT_NOISE = ["nickname", "sessions", "receipts", "nextSequence", "epoch", "ready", "tokenHash", "admissionHash", "joinedAt", "archivedAt", "leftLabel", "pick", "agreementRevision", "approvedProposalVersion", "lastVotedId", "memberGrant"] as const

/**
 * The deck inputs of a room: everything of its active part a catalog page can read (constraints, the room's country
 * and services, who is in it with their member link and seen setting, ideas, the deck so far), as a digest. Two rooms
 * with the same digest get the same first page. It leaves out only what a page never reads (ROOM_NOISE,
 * PARTICIPANT_NOISE), so anything new on a room counts as an input until it's listed there.
 *
 * Guests count only by the screens they watch on: a page reads a participant's screen (whose country and services
 * are the room's) and, for a linked member, their seen titles and saved progress. So a friend joining as a guest, or
 * picking services the room already has, leaves the deck prepared before they came up to date. Their own service
 * picks reach the page through the room's screen, which is an input.
 */
export function deckInputs(room: ProposalRoom): string {
	const active = activeRoom(room) as unknown as Record<string, unknown>
	const shape: Record<string, unknown> = { ...active }
	for (const key of ROOM_NOISE) delete shape[key]
	const present = room.participants.filter((p) => p.leftAt == null)
	// How many guests watch on a screen, or who they are, never changes a page: only which screens they watch on.
	shape.guestScreens = [...new Set(present.filter(guest).map((p) => String(p.screenId)))].sort()
	shape.participants = present
		.filter((p) => !guest(p))
		.map((p) => {
			const q: Record<string, unknown> = { ...p }
			for (const key of PARTICIPANT_NOISE) delete q[key]
			// A member's seen titles and saved progress are read through the grant; its token rotates, its presence counts.
			q.memberGrant = Boolean(p.memberGrant)
			return q
		})
	return createHash("sha256").update(stable(shape)).digest("base64url")
}

/** Nothing of theirs but their screen reaches a page: no member link, grant or account. */
const guest = (p: ProposalRoom["participants"][number]) =>
	p.member?.state !== "linked" && !p.memberUserId && !p.memberGrant

const stable = (value: unknown): string =>
	JSON.stringify(value, (_k, v) =>
		v && typeof v === "object" && !Array.isArray(v)
			? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]]))
			: v
	)

export interface PreparedDecksOptions {
	/** Quiet time after the last setup change before a deck is built (none by default: Start often follows at once). */
	delayMs?: number
	/** A prepared deck older than this is built again: offers and the title snapshot move on. */
	maxAgeMs?: number
	/** Background builds running at once, across rooms. */
	concurrency?: number
	/** Rooms whose decks are remembered (least recently used out). */
	maxRooms?: number
	now?: () => number
}

/**
 * First decks built while a room is in setup, so Start only has to flip the room to choosing.
 *
 * `schedule(roomId)` (after any committed change) builds the deck for the room's current deck inputs a little later,
 * in the background, one room at a time per slot. `page(room)` is the deck for the room as it is now: the prepared one
 * when its inputs are still the room's and it isn't too old, a build already running for these inputs, or a new build,
 * remembered under the inputs so a Start that loses its compare-and-swap to an unrelated write reuses it. A failed
 * build is never kept. Decks live in this process only: after a restart, or on another instance, Start builds as before.
 */
export class PreparedDecks {
	private entries = new Map<string, Entry>()
	private timers = new Map<string, ReturnType<typeof setTimeout>>()
	private queue: string[] = []
	private running = 0
	/** Rooms with a background build running: a change meanwhile waits in the queue and builds once after it. */
	private building = new Set<string>()
	private catalog: ProposalCatalog
	private read: (roomId: string) => Promise<ProposalRoom | null>
	private delayMs: number
	private maxAgeMs: number
	private concurrency: number
	private maxRooms: number
	private now: () => number
	constructor(
		catalog: ProposalCatalog,
		read: (roomId: string) => Promise<ProposalRoom | null>,
		options: PreparedDecksOptions = {}
	) {
		this.catalog = catalog
		this.read = read
		this.delayMs = options.delayMs ?? 0
		this.maxAgeMs = options.maxAgeMs ?? 10 * 60_000
		this.concurrency = options.concurrency ?? 2
		this.maxRooms = options.maxRooms ?? 500
		this.now = options.now ?? Date.now
	}
	/** Builds the room's deck in the background once its setup has been quiet for a moment. */
	schedule(roomId: string) {
		clearTimeout(this.timers.get(roomId))
		const timer = setTimeout(() => {
			this.timers.delete(roomId)
			if (!this.queue.includes(roomId)) this.queue.push(roomId)
			this.pump()
		}, this.delayMs)
		timer.unref?.()
		this.timers.set(roomId, timer)
	}
	/** The first page for the room as it is now (see the class comment). */
	async page(room: ProposalRoom): Promise<Page> {
		// Saved progress moves on without changing the room (an episode watched elsewhere): never remembered or reused.
		if (activeRoom(room).constraints.kinds.includes("show_continue"))
			return this.catalog.page(structuredClone(activeRoom(room)))
		const inputs = deckInputs(room)
		const entry = this.entries.get(room.id)
		if (entry && entry.inputs === inputs && this.now() - entry.builtAt < this.maxAgeMs) {
			try {
				return structuredClone(await entry.page)
			} catch {
				// A failed background build says nothing about now: build again below.
			}
		}
		return structuredClone(await this.build(room, inputs))
	}
	/** Whether a prepared deck (built or building) matches the room as it is now. For tests and logs. */
	prepared(room: ProposalRoom) {
		const entry = this.entries.get(room.id)
		return !!entry && entry.inputs === deckInputs(room) && this.now() - entry.builtAt < this.maxAgeMs
	}
	/** Resolves once no deck is waiting or building. For tests. */
	async idle(): Promise<void> {
		while (this.timers.size || this.queue.length || this.running) await new Promise((resolve) => setTimeout(resolve, 5))
	}
	forget(roomId: string) {
		this.entries.delete(roomId)
		clearTimeout(this.timers.get(roomId))
		this.timers.delete(roomId)
	}
	private build(room: ProposalRoom, inputs: string): Promise<Page> {
		const page = this.catalog.page(structuredClone(activeRoom(room)))
		const entry: Entry = { inputs, page, builtAt: this.now() }
		this.entries.delete(room.id)
		this.entries.set(room.id, entry)
		while (this.entries.size > this.maxRooms) this.entries.delete(this.entries.keys().next().value!)
		page.catch(() => {
			if (this.entries.get(room.id) === entry) this.entries.delete(room.id)
		})
		return page
	}
	private pump() {
		for (let i = 0; this.running < this.concurrency && i < this.queue.length; ) {
			const roomId = this.queue[i]
			if (this.building.has(roomId)) {
				i++
				continue
			}
			this.queue.splice(i, 1)
			this.running++
			this.building.add(roomId)
			void this.prepare(roomId)
				.catch(() => {})
				.finally(() => {
					this.running--
					this.building.delete(roomId)
					this.pump()
				})
		}
	}
	private async prepare(roomId: string) {
		const room = await this.read(roomId)
		if (!room || room.phase !== "setup" || room.expiresAt <= this.now()) {
			this.entries.delete(roomId)
			return
		}
		if (!ready(room) || this.prepared(room)) return
		await this.build(room, deckInputs(room)).catch(() => {})
	}
}

/** Whether Start could build a deck now: everyone present is on a confirmed screen with a country and services. */
function ready(room: ProposalRoom) {
	const active = activeRoom(room)
	if (!active.participants.length) return false
	if (active.constraints.kinds.includes("show_continue")) return false // Saved progress is read fresh at Start.
	return active.participants.every((p) => {
		const screen = active.screens.find((s) => s.id === p.screenId)
		return !!screen && screen.confirmed && !!screen.country && screen.serviceIds.length > 0
	})
}
