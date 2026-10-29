// What of a guest changes Discover's answer, as a short key: their progress (by its length and latest change) and the
// country and services they chose. Discover's results and the start page's mood counts key their queries by it, so a
// loved or hidden title asks again without hashing thousands of interactions on every render.
import type { GuestBody } from "./useDiscoverBrowse"

/** "pending" until the guest's browser is read, "member" for a member. */
export function guestSignature(guest: GuestBody | null | undefined) {
	if (guest === undefined) return "pending"
	if (guest === null) return "member"
	const last = guest.interactions[guest.interactions.length - 1]
	return `guest:${guest.interactions.length}:${last?.timestamp ?? ""}:${guest.country ?? ""}:${guest.services ?? ""}`
}
