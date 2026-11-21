// PROTOTYPE - throwaway (prototype/explore-r5). Part slot "card": a place as a card, for every family. Its props are `CardProps`
// (kit/types.ts): place, href, copy, titles, traits, and per family kinds, rose, goodAt, weight. A page renders
// `<Part slot="card" {...card} href={...} />`; `cardData(kit, family)` (cards.server.ts) loads the data. The kit's own
// PlaceCard and the Rooms genre, era and service cards hand over to the picked variant too, so a pick changes the
// round 4 baseline pages as well.
//
// The owner: "mood, genre and similar cards need much better design. Biggest issue are the clickable, fixed posters.
// They should be less in focus and more the actual card's main identity (a specific country, a mood's color coding)."
import type { SlotMeta } from "../../contract"

export type { CardData, CardProps } from "../../../../kit/types"

export const slot: SlotMeta = {
	id: "card",
	label: "Cards",
	order: 2,
	group: "part",
	// Where places show as cards: the hub, every family's index page, and a place's own page (its ways onward). The
	// identity variants load their data (marks.server.ts) on these addresses.
	applies: (address) =>
		address.view === "hub" || address.view === "family" || address.view === "place",
	fallback: "peek",
}
