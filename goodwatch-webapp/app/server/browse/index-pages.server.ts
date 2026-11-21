// The Browse pages that aren't a place page: the family indexes (moods, genres, eras, places) and the room pages of a
// single decade, country or streaming service. Each answers its own data; the route renders the matching page.
import type { Address } from "~/domain/browse/address"
import { loadCountryPage } from "~/server/browse/country-page.server"
import { loadEraPage } from "~/server/browse/era-page.server"
import { loadErasPage } from "~/server/browse/eras.server"
import { loadGenresPage } from "~/server/browse/genres.server"
import { loadHubPage } from "~/server/browse/hub/hub.server"
import type { BrowseLoadArgs } from "~/server/browse/load-args"
import { loadMoodsPage } from "~/server/browse/moods.server"
import { type PlaceData, loadPage } from "~/server/browse/place-data.server"
import { loadPlacesPage } from "~/server/browse/places-page.server"

/** Which index or room page an address opens, or null when it opens none of them. */
export function indexPageOf(a: Address) {
	if (a.view === "hub") return "hub" as const
	if (a.view === "family") {
		if (a.family === "mood") return "moods" as const
		if (a.family === "genre") return "genres" as const
		if (a.family === "decade") return "eras" as const
		if (a.family === "country") return "places" as const
		return null
	}
	if (a.view === "place" && a.parts.length === 1) {
		if (a.parts[0].family === "decade") return "era" as const
		if (a.parts[0].family === "country") return "country" as const
		if (a.parts[0].family === "service") return "service" as const
	}
	return null
}

export type IndexPage = NonNullable<ReturnType<typeof indexPageOf>>

export async function loadIndexPage(page: IndexPage, args: BrowseLoadArgs) {
	switch (page) {
		case "hub":
			return { page, data: await loadHubPage(args) }
		case "moods":
			return { page, data: await loadMoodsPage(args) }
		case "genres":
			return { page, data: await loadGenresPage(args) }
		case "eras":
			return { page, data: await loadErasPage(args) }
		case "places":
			return { page, data: await loadPlacesPage(args) }
		case "era":
			return { page, data: await loadEraPage(args) }
		case "country":
			return { page, data: await loadCountryPage(args) }
		case "service":
			return { page, data: (await loadPage(args)) as PlaceData }
	}
}

export type IndexPageData = Awaited<ReturnType<typeof loadIndexPage>>
