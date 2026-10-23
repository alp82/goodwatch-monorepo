import type { ProposalRoom } from "./proposal-types.ts"
import { requireRoom } from "./errors.ts"

/** One room-wide availability context. Legacy catalog adapters consume a singleton projection. */
export const ROOM_CONTEXT = "room"
export function activeRoom(room: ProposalRoom): ProposalRoom {
	return {
		...room,
		participants: room.participants.filter((p) => p.leftAt == null),
	}
}
export function normalizeRoomContext(room: ProposalRoom) {
	const selected = room.screens.filter((s) => s.confirmed)
	const first = selected[0]
	requireRoom(
		selected.every(
			(s) =>
				s.country === first?.country &&
				JSON.stringify([...s.serviceIds].sort()) ===
					JSON.stringify([...(first?.serviceIds ?? [])].sort())
		),
		"needs_context",
		"Choose one country and provider selection for this room"
	)
	room.screens = first
		? [{ ...first, id: ROOM_CONTEXT, label: "Our room" }]
		: []
	for (const p of room.participants) {
		p.screenId = first ? ROOM_CONTEXT : null
		p.ready = !!first
	}
	for (const c of room.candidates)
		c.availability = c.availability.length
			? [{ ...c.availability[0], screenId: ROOM_CONTEXT }]
			: []
	if (room.decision)
		room.decision.availability = room.decision.availability.length
			? [{ ...room.decision.availability[0], screenId: ROOM_CONTEXT }]
			: []
}
