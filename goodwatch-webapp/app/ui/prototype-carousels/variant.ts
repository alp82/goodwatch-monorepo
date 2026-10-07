// PROTOTYPE for "Prototype native-scroll carousels on title pages". Throwaway code: not for production.
//
// Four variants of the cast row and the related titles section of a title page, switchable with `?proto=` on the
// existing movie and show routes (see server/prototype-carousels.server.ts for the switch):
// - today: today's page (Swiper), with the switcher showing. For comparing on the same device.
// - rows: native-scroll cast row, native-scroll related tab row and rows.
// - list: native-scroll cast row, related titles as a short list with a reason per title.
// - explore: native-scroll cast row, related titles as an entry into exploring similar titles.
//
// Second round, after the owner tried the first: five more forms of the related titles section, all explore-like,
// usable in place, with a reason per title (see explore-model.ts for how the reasons are computed):
// - explore1: a constellation with spokes named by a shared trait.
// - explore2: clusters named by how their titles differ from this one.
// - explore3: a walk in place, one title per direction.
// - explore4: this title's traits as chips that pick the titles.
// - explore5: a map with two named axes of difference.
//
// Third round, after the owner tried the second: five forms built from the constellation, in which a tap on a
// poster never leaves the page and never moves it (see WalkSection.tsx for the rule and how it is kept):
// - walk1: a calm ring of eight, one reason line.
// - walk2: a compass, four named ways to differ.
// - walk3: a path, with the trail as part of the picture.
// - walk4: an orbit whose caption explains one neighbor at a time.
// - walk5: four named piles that spread out in place.
//
// Fourth round, after the owner tried the third: four forms in which the directions keep their words and places for
// the whole walk, the title you came from sits opposite the step, and a direction can be dived into (see
// dive-model.ts for the scheme and DiveSection.tsx for the forms):
// - dive1: a ring with labeled sides. A dive opens one side into a fan.
// - dive2: a compass with steady axes. A dive makes one arm a long row.
// - dive3: a path with four lanes. A dive loads a lane further.
// - dive4: four piles. Opening a pile lays it out from a bit to much.
// - dive5: the compass with a dial. Two axes are few: the visitor picks what up and down mean from five, and
//   lighter and darker stay left and right. Added after building the four, because every one of them is limited to
//   the two axes the server chose.
//
// Fifth round, after the owner tried the fourth: nine forms built on the labeled ring (see ring-model.ts for the
// scheme and RingSection.tsx for what changed): three titles per side, a dive with its own way out, distance from
// the middle that means "a bit" to "much" in every direction, several dials, and forms with one axis or three.
// - ring1: the baseline. The labeled ring with only the fixes.
// - ring2: the ring whose words choose what their axis is about. Both axes.
// - ring3: the ring with presets that set both axes at once.
// - ring4: the ring whose up and down is one of the title's own traits.
// - ring5: three axes, six spokes.
// - ring6: one axis as a line that scrolls outward, with a list of what the line can mean. No dive mode.
// - ring7: one axis up and down, as ranks. The words choose what it means. No dive mode.
// - ring8: two axes as four arms that scroll outward. The words choose. No dive mode.
// - ring9: one axis left and right, as ranks, from the title's own traits. No dive mode.
//
// Sixth round, after the owner tried the fifth: breadth instead of refinement. Six different ideas, each taking the
// look and feel of the Explorer (its sea, islands, names, minimap, proximity card, zoom) and shrinking it into the
// section (see server/prototype-sea-view.server.tsx for the forms and SeaSection.tsx for the layers):
// - sea1: a pocket sea. A map wider than the stage with an island per direction, dragged sideways, with a minimap.
// - sea2: ranks on water. Six arms of islets on range rings: the fifth round's six ways and its graded ranks.
// - sea3: zoom levels. An archipelago seen from afar, and islands you go into.
// - sea4: a voyage. Every step adds a leg to a route that stays on the map.
// - sea5: compass and horizon. The sea tilted away from you, and a compass that turns what lies ahead.
// - sea6: a lantern. Every title where it lies, small, and a light that names what it falls on.
// The floating bar shows today, the fifth round's six ways and trait bow for comparison, and these six. The other
// variants still answer to the URL.
import { useMatches } from "@remix-run/react"
import type { ExploreModel } from "~/ui/prototype-carousels/explore-model"

export const CAROUSEL_VARIANTS = [
	"today",
	"rows",
	"list",
	"explore",
	"explore1",
	"explore2",
	"explore3",
	"explore4",
	"explore5",
	"walk1",
	"walk2",
	"walk3",
	"walk4",
	"walk5",
	"dive1",
	"dive2",
	"dive3",
	"dive4",
	"dive5",
	"ring1",
	"ring2",
	"ring3",
	"ring4",
	"ring5",
	"ring6",
	"ring7",
	"ring8",
	"ring9",
	"sea1",
	"sea2",
	"sea3",
	"sea4",
	"sea5",
	"sea6",
] as const
export type CarouselVariant = (typeof CAROUSEL_VARIANTS)[number]

/** The variants the floating bar cycles through. */
export const CAROUSEL_BAR: CarouselVariant[] = [
	"today",
	"ring5",
	"ring9",
	"sea1",
	"sea2",
	"sea3",
	"sea4",
	"sea5",
	"sea6",
]

export const CAROUSEL_VARIANT_NAMES: Record<CarouselVariant, string> = {
	today: "Today (Swiper)",
	rows: "Native rows",
	list: "List with reasons",
	explore: "Explore entry",
	explore1: "1 Constellation",
	explore2: "2 Clusters",
	explore3: "3 Walk",
	explore4: "4 Trait chips",
	explore5: "5 Map",
	walk1: "W1 Calm ring",
	walk2: "W2 Compass",
	walk3: "W3 Path",
	walk4: "W4 One voice",
	walk5: "W5 Piles",
	dive1: "D1 Labeled ring",
	dive2: "D2 Steady compass",
	dive3: "D3 Lanes",
	dive4: "D4 Piles that open",
	dive5: "D5 Compass with a dial",
	ring1: "R1 Ring, fixed",
	ring2: "R2 Words choose",
	ring3: "R3 Presets",
	ring4: "R4 Own traits",
	ring5: "R5 Six ways",
	ring6: "R6 One line",
	ring7: "R7 Up and down",
	ring8: "R8 Four arms",
	ring9: "R9 Trait bow",
	sea1: "S1 Pocket sea",
	sea2: "S2 Ranks on water",
	sea3: "S3 Islands to go into",
	sea4: "S4 Voyage",
	sea5: "S5 Compass and horizon",
	sea6: "S6 Lantern",
}

export const CAROUSEL_PROTOTYPE_COOKIE = "gw_proto_carousels"

export const isCarouselVariant = (value: unknown): value is CarouselVariant =>
	CAROUSEL_VARIANTS.includes(value as CarouselVariant)

export interface CarouselPrototypeData {
	variant: CarouselVariant
	/** List variant: per related title ("movie-603"), the fingerprint attributes it shares most with this title. */
	reasons: Record<string, string[]>
	/** Explore variant: the Explorer's mood island this title fits best. */
	island: { id: string; name: string; color: string } | null
	/** explore1 to explore5: what the section shows. */
	explore?: ExploreModel
	/** walk1 to walk5: the section's markup. An inline script drives it, React doesn't. */
	walk?: { html: string }
	/** dive1 to dive5: the section's markup, driven the same way. */
	dive?: { html: string }
	/** ring1 to ring9: the section's markup, driven the same way. */
	ring?: { html: string }
	/** sea1 to sea6: the section's markup. An inline script drives the taps, a lazy module the rest. */
	sea?: { html: string }
}

/** The prototype's data from the title route's loader, or null for today's page. */
export function useCarouselPrototype(): CarouselPrototypeData | null {
	for (const match of useMatches()) {
		const data = match.data as
			| { carouselPrototype?: CarouselPrototypeData }
			| undefined
		if (data?.carouselPrototype) return data.carouselPrototype
	}
	return null
}
