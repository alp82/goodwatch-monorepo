// A decade's page with the decade's
// years on a dial. The best of the whole decade and of each year, with a sentence each, and the decades on both
// sides as the dial's ways out.
import { ing } from "~/domain/browse/address"
import type { PlaceRef, ShowTitle } from "~/domain/browse/types"
import type { PlaceData } from "~/server/browse/place-data.server"
import { loadPage } from "~/server/browse/place-data.server"
import type { BrowseLoader } from "~/ui/browse/view"
import { type Obsession, lean, times } from "~/server/browse/era-time.server"

export interface EraYearsData {
	rooms: PlaceData
	decade: PlaceRef
	/** The best-loved of the whole decade, with a sentence each. */
	top: ShowTitle[]
	years: { year: number; titles: ShowTitle[] }[]
	before: PlaceRef | null
	after: PlaceRef | null
	/** What the decade could not stop making titles about, strongest first. */
	obsessions: Obsession[]
	/** The year the address asks for, when it is one of this decade's. */
	year: number | null
}

export const loadEraPage: BrowseLoader<EraYearsData> = async (args) => {
	const { atlas, address } = args
	const slug = address.parts[0].slug
	// The decade's true best first, then each year's: the rest of the page avoids both.
	const top = await atlas.showcase(address.parts, 5, { by: "best", lines: true })
	const era = await atlas.era(slug, 5, { lines: true })
	const rooms = (await loadPage(args)) as PlaceData
	const decades = atlas.members("decade")
	const i = decades.findIndex((d) => d.slug === slug)
	const years = (era?.years ?? [])
		.filter((y) => y.titles.length > 0)
		.map((y) => ({ year: y.year, titles: y.titles.map(lean) }))
	const t = times(atlas, 4)
	return {
		rooms,
		obsessions: (t.decades.find((d) => d.place.slug === slug)?.obsessions ?? []).map(
			(key) => t.words[key],
		),
		decade: atlas.ref(ing("decade", slug)),
		top: top.map(lean),
		years,
		before: decades[i - 1] ?? null,
		after: decades[i + 1] ?? null,
		year: years.some((y) => y.year === address.year) ? (address.year ?? null) : null,
	}
}
