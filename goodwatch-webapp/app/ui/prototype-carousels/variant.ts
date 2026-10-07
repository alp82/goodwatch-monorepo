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
// `rows` and `list` still answer to the URL, but the floating bar leaves them out.
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
] as const
export type CarouselVariant = (typeof CAROUSEL_VARIANTS)[number]

/** The variants the floating bar cycles through. */
export const CAROUSEL_BAR: CarouselVariant[] = [
	"today",
	"explore",
	"explore1",
	"explore2",
	"explore3",
	"explore4",
	"explore5",
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
