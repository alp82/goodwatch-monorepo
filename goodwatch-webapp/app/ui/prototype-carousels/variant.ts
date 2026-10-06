// PROTOTYPE for "Prototype native-scroll carousels on title pages". Throwaway code: not for production.
//
// Four variants of the cast row and the related titles section of a title page, switchable with `?proto=` on the
// existing movie and show routes (see server/prototype-carousels.server.ts for the switch):
// - today: today's page (Swiper), with the switcher showing. For comparing on the same device.
// - rows: native-scroll cast row, native-scroll related tab row and rows.
// - list: native-scroll cast row, related titles as a short list with a reason per title.
// - explore: native-scroll cast row, related titles as an entry into exploring similar titles.
import { useMatches } from "@remix-run/react"

export const CAROUSEL_VARIANTS = ["today", "rows", "list", "explore"] as const
export type CarouselVariant = (typeof CAROUSEL_VARIANTS)[number]

export const CAROUSEL_VARIANT_NAMES: Record<CarouselVariant, string> = {
	today: "Today (Swiper)",
	rows: "Native rows",
	list: "List with reasons",
	explore: "Explore entry",
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
