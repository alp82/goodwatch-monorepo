// The loader of the start page with the new TV (docs/implementation/tv-screen-revamp, section 3). Until the
// switch only /home-preview uses it; `/` keeps `loadLivingRoom` (server/living-room.server.ts).
//
// A guest gets the titles below the room and one picture, the first start title's backdrop: nothing personal, so
// the HTML is the same for every guest. A member gets Tonight and My shows from `getTonightParts`, the read home's
// doors use (tv-home.server.ts shapes them). Nothing here reads the Wishlist's cards: the new TV shows no count
// of them.
//
// Both get the two streaming services the Remote's keys and home's tiles stand for (`loadTvServices`). A guest's
// are the first two of their country's catalog, so a guest's HTML differs by country and by nothing else. The
// country is the one of the request's cache identity, which is part of a stored page's key already
// (cache-identity.server.ts), so the page cache keeps one page per country as before.
import { json } from "@remix-run/node"
import { getLocaleFromRequest } from "~/server/cache-identity.server"
import { getTonightParts } from "~/server/home-doors.server"
import { getStreamingProviders } from "~/server/streaming-providers.server"
import type { Taste } from "~/server/taste/index.server"
import { loadMemberTaste } from "~/server/taste/member.server"
import {
	getDisplayFields,
	getServiceCards,
	getTitleCards,
} from "~/server/title-cards.server"
import { getTitleSnapshot } from "~/server/title-snapshot/index.server"
import {
	type ViewerContext,
	getMemberViewerContext,
} from "~/server/viewer.server"
import type { TvHomeData, TvService } from "~/ui/living-room/tv/tv-home"
import { titleKey } from "~/utils/title-key"
import { PRIVATE_CACHE_CONTROL, livingRoomAuth } from "./data.server"
import { loadStartTitlesAndPicture } from "./start-titles.server"
import {
	guestHome,
	keepCountryServices,
	memberHome,
	tonightShowIds,
	tvServices,
} from "./tv-home.server"

/**
 * The first services of a country's catalog. The catalog's read (`getStreamingProviders`, the data cache's:
 * about a thousand rows with every country's order) happens once per country and day in this process; after it
 * a guest's loader reads nothing for its services.
 */
const loadCountryServices = keepCountryServices((country) =>
	getStreamingProviders({ country }),
)

/**
 * The two services the Remote's keys and home's tiles stand for: a member's first two saved services (`saved`,
 * their ids in the order they saved them), filled up from their country's catalog; a guest's the first two of
 * the country's catalog. Never fails: what cannot be read is filled up from the fixed pair.
 */
export async function loadTvServices(
	country: string,
	saved: readonly number[] = [],
): Promise<TvService[]> {
	const [own, catalog] = await Promise.all([
		saved.length
			? getServiceCards([...saved]).catch((error) => {
					console.error("The TV: loading a member's services failed", error)
					return []
				})
			: [],
		loadCountryServices(country),
	])
	return tvServices(own, catalog)
}

/** A member's Tonight and My shows: one read of what home's doors read, and the cards of the shows Tonight names. */
export async function loadMemberHome(
	viewer: ViewerContext,
	taste: Taste,
	now = Date.now(),
) {
	const parts = await getTonightParts(viewer, taste, now)
	const ids = tonightShowIds(parts)
	const cards = ids.length
		? await getTitleCards(
				ids.map((id) => titleKey("show", id)),
				viewer,
				taste,
			)
		: []
	return memberHome(parts, cards)
}

export async function loadTvHome(request: Request) {
	const { user, headers } = await livingRoomAuth(request)
	// SEAM (the switch): on `/` a guest's page takes the shared cache policy `livingRoomAuth` chose, and the
	// incomplete-page policy without start titles, as `loadLivingRoom` does. The preview address is never stored.
	// A guest's page whose services could not be read shows the fixed pair, which may not be the country's first
	// two: that page should take the incomplete-page policy too, so it is not stored for the country.
	headers.set("Cache-Control", PRIVATE_CACHE_CONTROL)
	const start = loadStartTitlesAndPicture(getTitleSnapshot(), getDisplayFields)
	// The country of the request's cache identity: a guest's page is the same for every guest of it.
	const country = getLocaleFromRequest(request).locale.country
	if (!user) {
		const [home, services] = await Promise.all([start, loadTvServices(country)])
		return { data: guestHome(home, services), headers }
	}

	// A member's home works without Tonight and My shows: the tiles are there and Tonight falls back to the pool's
	// best, as for a guest. So a failed read leaves that, not an error page.
	const viewer = getMemberViewerContext(user.id, country)
	// A member's own services, in their saved country; without their settings, the request's country's.
	const services = viewer
		.then((v) => loadTvServices(v.country, v.services))
		.catch(() => loadTvServices(country))
	const own = (async () => {
		const [taste, v] = await Promise.all([loadMemberTaste(user.id), viewer])
		return {
			...(await loadMemberHome(v, taste)),
			// What the Discover page's loader hands its search (`searchScope`), for the TV's.
			scope: { country: v.country, services: v.services },
		}
	})().catch((error): Pick<TvHomeData, "tonight" | "shows" | "scope"> => {
		console.error(
			"The TV: loading a member's Tonight and My shows failed",
			error,
		)
		return { tonight: [], shows: { next: [], start: [] } }
	})
	const data: TvHomeData = {
		...guestHome(await start, await services),
		member: true,
		...(await own),
	}
	return { data, headers }
}

export async function tvHomeLoader({ request }: { request: Request }) {
	const { data, headers } = await loadTvHome(request)
	return json(data, { headers })
}
