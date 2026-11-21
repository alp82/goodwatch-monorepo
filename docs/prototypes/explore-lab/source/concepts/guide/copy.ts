// PROTOTYPE - throwaway (prototype/explore-r4, concept `guide`). The copy deck, read directly: the deck names its
// families in the plural ("moods"), the kit's addresses in the singular ("mood").
import { type CopyFamily, copyFor as deck, headings } from "../../kit/copy"
import type { Family, Kind } from "../../kit/address"

const PLURAL: Partial<Record<Family, CopyFamily>> = {
	mood: "moods",
	genre: "genres",
	theme: "themes",
	style: "styles",
	decade: "decades",
	country: "countries",
	service: "services",
}

const kindOf = (kind: Kind) => (kind === "all" ? "all" : kind === "show" ? "shows" : "movies")

/** A place's hand-written text, or null. */
export function placeCopy(kind: Kind, family: Family, slug: string, code?: string) {
	const fam = PLURAL[family]
	if (!fam) return null
	return deck(kindOf(kind), fam, family === "country" && code ? code : slug)
}

export const bestCopy = (kind: Kind) => deck(kindOf(kind), "best", "all")
export const hubCopy = (kind: Kind, id: string) => deck(kindOf(kind), "hub", id)
/** A family's own page ("Movies by mood"). */
export const familyCopy = (kind: Kind, family: Family) =>
	deck(kindOf(kind), "hub", PLURAL[family] ?? "home")

export { headings }
