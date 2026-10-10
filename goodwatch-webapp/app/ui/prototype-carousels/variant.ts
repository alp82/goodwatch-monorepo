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
// - sea6: the minimap as the control. The stage shows one island up close, and the small map moves you.
//
// Seventh round, after the owner tried the sixth: breadth again, measured against three goals: speed (the stage
// answers a tap at once, from data the browser already holds), exploration, and interactivity with the fingerprint
// traits in the form itself (see play-engine.ts for the data path and play-forms.ts for the forms).
// - play1: six ways, fast. The fifth round's six directions; "more" pans the map into ranks, and a back control leaves.
// - play2: horizon. All six directions at once as lanes toward the horizon, a bit to much.
// - play3: honeycomb. A lattice that slides under you one tap at a time, and remembers where you were.
// - play4: trait mixer. Sliders for four traits rank the neighborhood again while you drag.
// - play5: fingerprint hub. The title's fingerprint as a glyph, with a title at the end of each spoke that has more.
// - play6: diff tiles. A mosaic whose tiles say how they differ, with a second page to the right.
// - play7: trait lens. Trait chips light up the titles that share them; two or three narrow it down.
// - play8: scrub. A strip along one axis that scrolls sideways, with what is under the marker shown large.
// - play9: blend. Two titles, what they share, and the titles between them.
// - play10: pick a path. Three choices with their differences spelled out, and the path they add up to.
//
// Eighth round, after the owner tried the seventh: the scrub strip impressed, but its scales read wrong (a title
// that is big and talky at once sat at the "More intimate" end). Ten variations on the strip that differ in how a
// scale is built from the fingerprint, how it is chosen, labeled, and combined, and how many strips there are (see
// scrub-forms.ts):
// - scrub1: honest ruler. One trait, absolute from 0 to 10, with ticks and gaps.
// - scrub2: only clear claims. The old axes, but an end is claimed only where it holds.
// - scrub3: of these, in general. The old order, read as relative and as absolute, side by side.
// - scrub4: two at once. Two traits as two dimensions: along the strip, and as a band.
// - scrub5: its own fingerprint. The title's fingerprint is the picker, all 74 attributes by family.
// - scrub6: what varies here. The picker leads with the traits this neighborhood spreads on, and has a search.
// - scrub7: both of two. Two traits combined, ordered by the lower of the two levels.
// - scrub8: hold and scrub. One trait held high, another scrubbed.
// - scrub9: recipe. Up to three chips, more of this and less of that.
// - scrub10: three lanes. Three linked strips, one per fingerprint family.
//
// Ninth round, after the owner tried the eighth: the trait play is fun but the results are too alike, the trait
// choice of the recipe is not intuitive, the honest ruler shows too little of the field, and strips in several rows
// did not work. Three combined forms on a pack that reaches further along four traits per title (see best-forms.ts):
// - best1: trait strip. One trait at a time, the card's bars are the switch, and a small map of the whole strip.
// - best2: trait compass. Three traits as six directions on a honeycomb, near and far, with the combinations between.
// - best3: more and less. Four steppers bend the road of similar titles, and the bend stays while you walk.
//
// Tenth round, after the owner tried the ninth: away from the strips, toward one title in the middle with the related
// titles around it, where distance from the middle is similarity (see roam-forms.ts):
// - roam1: rings. Nearer is more alike. Three switches from the title's fingerprint, and a zoom.
// - roam2: spiral. One arm that winds outward, and can be wound further.
// - roam3: open field. A wide map that pans sideways, each poster saying how it differs most.
// - roam4: neighborhoods. Titles that are alike each other share a side, with a caption.
// - roam5: with, without. The switches as four sides, all visible at once.
//
// Eleventh round, after the owner tried the tenth: the rings are the favourite. Their movement becomes a pan that
// the eye can follow, pointing at a poster shows it in the card, and ten forms vary only the control area (see
// rings-forms.ts):
// - roam1: the baseline with the fixes. roam0 is the tenth round's own, kept for measuring.
// - rings1: bars. rings2: three stops. rings3: words and a dice. rings4: edges of the map. rings5: legend.
// - rings6: pad. rings7: blend. rings8: practical facts. rings9: heading. rings10: in words.
//
// Twelfth round, after the owner tried the eleventh: the slow motion is the motion (a step four times as long, a zoom
// twice), the bars, the legend, the heading, and the words stay, and six remixes of them join (see mix-forms.ts):
// - mix1: level chips. mix2: legend bars. mix3: one heading. mix4: signposts. mix5: before and after.
// - mix6: keep what you found.
//
// Thirteenth round, after the owner tried the twelfth: the level chips are the one. Three forms on top of them that
// share the chips, the sweep on a chip that is on, and what chips and posters show of each other, and differ in the
// navigation and the card (see fin-forms.ts):
// - fin1: path bar. fin2: poster trail. fin3: one card.
// The floating bar shows today, the baseline, the remixes the three draw on, and the three. The other variants
// still answer to the URL.
import { useMatches } from "@remix-run/react"
import type { ExploreModel } from "~/ui/prototype-carousels/explore-model"
import { PLAY_NAMES } from "~/ui/prototype-carousels/play-names"

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
	"play1",
	"play2",
	"play3",
	"play4",
	"play5",
	"play6",
	"play7",
	"play8",
	"play9",
	"play10",
	"scrub1",
	"scrub2",
	"scrub3",
	"scrub4",
	"scrub5",
	"scrub6",
	"scrub7",
	"scrub8",
	"scrub9",
	"scrub10",
	"best1",
	"best2",
	"best3",
	"roam0",
	"roam1",
	"roam2",
	"roam3",
	"roam4",
	"roam5",
	"rings1",
	"rings2",
	"rings3",
	"rings4",
	"rings5",
	"rings6",
	"rings7",
	"rings8",
	"rings9",
	"rings10",
	"mix1",
	"mix2",
	"mix3",
	"mix4",
	"mix5",
	"mix6",
	"fin1",
	"fin2",
	"fin3",
] as const
export type CarouselVariant = (typeof CAROUSEL_VARIANTS)[number]

/**
 * The variants the floating bar cycles through. Thirteenth round: today, the rings with the fixes, the remixes the
 * new forms draw on, and the three new forms. Everything else still answers to the URL.
 */
export const CAROUSEL_BAR: CarouselVariant[] = ["today", "roam1", "mix1", "mix3", "mix4", "mix5", "fin1", "fin2", "fin3"]

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
	sea6: "S6 Small map steers",
	play1: "",
	play2: "",
	play3: "",
	play4: "",
	play5: "",
	play6: "",
	play7: "",
	play8: "",
	play9: "",
	play10: "",
	scrub1: "",
	scrub2: "",
	scrub3: "",
	scrub4: "",
	scrub5: "",
	scrub6: "",
	scrub7: "",
	scrub8: "",
	scrub9: "",
	scrub10: "",
	best1: "",
	best2: "",
	best3: "",
	roam0: "",
	roam1: "",
	roam2: "",
	roam3: "",
	roam4: "",
	roam5: "",
	rings1: "",
	rings2: "",
	rings3: "",
	rings4: "",
	rings5: "",
	rings6: "",
	rings7: "",
	rings8: "",
	rings9: "",
	rings10: "",
	mix1: "",
	mix2: "",
	mix3: "",
	mix4: "",
	mix5: "",
	mix6: "",
	fin1: "",
	fin2: "",
	fin3: "",
	...PLAY_NAMES,
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
	/** play1 to play10: the section's markup, drawn by the play engine. Its inline script draws every later stage. */
	play?: { html: string }
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
