// The copy deck by family: a place's hand-written lede and short line, or a page's text (the hub, a family index, Top).
import type { Family, Kind } from "./address"
import { type CopyFamily, copyFor as deckCopyFor } from "./copy"
import type { Copy } from "./types"

// The deck is written per kind, with a text of its own for movies and shows together.
const deckKind = (kind: Kind) => (kind === "all" ? "all" : kind === "show" ? "shows" : "movies")

/** The copy deck's family names (plural); a fingerprint trait has no hand-written copy. */
const COPY_FAMILY: Partial<Record<Family | "best" | "hub", string>> = {
	mood: "moods",
	genre: "genres",
	theme: "themes",
	style: "styles",
	decade: "decades",
	country: "countries",
	service: "services",
	best: "best",
	hub: "hub",
}

/** The hand-written copy of a place (lede and a short line), or null when the deck has none. */
export function copyFor(kind: Kind, family: Family | "best" | "hub", slug: string): Copy | null {
	const deck = COPY_FAMILY[family]
	if (!deck) return null
	return deckCopyFor(deckKind(kind), deck as CopyFamily, slug) ?? null
}

/** The deck's text for the hub ("home"), a family's index ("moods", "genres", ...) or Top ("all"). */
export function pageCopy(kind: Kind, deck: "hub" | "best", id: string): Copy | null {
	return deckCopyFor(deckKind(kind), deck as CopyFamily, id) ?? null
}
