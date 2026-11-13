import type { ContinuousMembers } from "./continuous-members.server.ts"
import type { ExcludedKeysOptions, ProposalRoom } from "./proposal-types.ts"

/** Members whose seen titles a room leaves out: present, linked, and not showing what they've seen. */
const excluding = (room: ProposalRoom) =>
	room.participants.filter((p) => p.leftAt == null && p.member.state === "linked" && !p.showSeen)

/** A catalog's member exclusions (ProposalCatalog.excludedKeys and refreshExcludedKeys) from members' seen titles. */
export function memberExclusions(members: ContinuousMembers) {
	return {
		async excludedKeys(room: ProposalRoom, options?: ExcludedKeysOptions) {
			return (
				await Promise.all(
					excluding(room).map((p) => (options?.stored ? members.seenStored(room, p.id, { read: options.readMissing !== false }) : members.seenOrNone(room, p.id)))
				)
			).flat()
		},
		refreshExcludedKeys(room: ProposalRoom) {
			for (const p of excluding(room)) members.refreshSeen(room, p.id)
		},
	}
}

/**
 * Keeps members' seen copies recent while a room is set up and quiet: every `everyMs` it reads the room and, while it
 * is still in setup, refreshes its members' copies (ContinuousMembers.refreshSeen reads GoodWatch once a copy is 10 s
 * old). It stops `forMs` after the room's last change, or once the room has started or expired. This bounds how long a
 * grant GoodWatch revoked can still shape Start (Start uses a copy at most seenCopyMaxAgeMs old, and a refused read
 * ends it); a room quiet for longer gets the bounded fresh read at Start instead.
 */
export class ExclusionKeepAlive {
	private rooms = new Map<string, { until: number; timer?: ReturnType<typeof setTimeout> }>()
	private read: (roomId: string) => Promise<ProposalRoom | null>
	private refresh: (room: ProposalRoom) => void
	private now: () => number
	private everyMs: number
	private forMs: number
	private maxRooms: number
	constructor(
		read: (roomId: string) => Promise<ProposalRoom | null>,
		refresh: (room: ProposalRoom) => void,
		options: { now?: () => number; everyMs?: number; forMs?: number; maxRooms?: number } = {}
	) {
		this.read = read
		this.refresh = refresh
		this.now = options.now ?? Date.now
		this.everyMs = options.everyMs ?? 10_000
		this.forMs = options.forMs ?? 10 * 60_000
		this.maxRooms = options.maxRooms ?? 2_000
	}
	/** The room changed in setup: keep its copies recent for `forMs` from now. */
	touch(roomId: string) {
		const until = this.now() + this.forMs
		const kept = this.rooms.get(roomId)
		if (kept) {
			kept.until = until
			return
		}
		const entry: { until: number; timer?: ReturnType<typeof setTimeout> } = { until }
		this.rooms.set(roomId, entry)
		while (this.rooms.size > this.maxRooms) this.stop(this.rooms.keys().next().value!)
		this.arm(roomId, entry)
	}
	stop(roomId: string) {
		clearTimeout(this.rooms.get(roomId)?.timer)
		this.rooms.delete(roomId)
	}
	/** Rooms kept recent. For tests. */
	get size() {
		return this.rooms.size
	}
	private arm(roomId: string, entry: { until: number; timer?: ReturnType<typeof setTimeout> }) {
		entry.timer = setTimeout(() => void this.tick(roomId, entry), this.everyMs)
		entry.timer.unref?.()
	}
	private async tick(roomId: string, entry: { until: number; timer?: ReturnType<typeof setTimeout> }) {
		if (this.rooms.get(roomId) !== entry) return
		if (this.now() >= entry.until) return this.stop(roomId)
		const room = await this.read(roomId).catch(() => null)
		if (this.rooms.get(roomId) !== entry) return
		if (!room || room.phase !== "setup" || room.expiresAt <= this.now()) return this.stop(roomId)
		try {
			this.refresh(room)
		} catch {
			// Refreshes never throw; a broken one must not end the keep-alive either.
		}
		this.arm(roomId, entry)
	}
}
