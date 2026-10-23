// The loader of the start page (docs/implementation/tv-screen-revamp, section 3).
//
// A guest gets the titles below the room and one picture, the first start title's backdrop: nothing personal, so
// the HTML is the same for every guest, and the page is stored under the shared cache policy `livingRoomAuth`
// chose. Without start titles (the snapshot is still loading, or they couldn't be read) the page is incomplete and
// no cache keeps it, so the titles are there as soon as they can be. A member's page is never stored. A member gets Tonight and My shows from `getTonightParts`, the read home's
// doors use (tv-home.server.ts shapes them). Nothing here reads the Wishlist's cards: the new TV shows no count
// of them.
//
// Both get the two streaming services the Remote's keys and home's tiles stand for. A guest's are Netflix and
// Prime Video, read from nowhere, so a guest's HTML stays the same for every guest. A member's are their first two
// saved services (`loadTvServices`), filled up with Netflix and Prime Video.
//
// Members lead with their existing Next pick and get a secondary popular row. Taste groups load only on Taste.
import { json } from "@remix-run/node"
import { presentCatalogLoader } from "~/server/media-payload.server"
import { getTalkedAboutNow } from "~/server/talked-about-now/start-row.server"
import { talkedAboutNowEnabled } from "~/server/talked-about-now/flags.server"
import { getTonightParts } from "~/server/home-doors.server"
import type { Taste } from "~/server/taste/index.server"
import { loadMemberTaste } from "~/server/taste/member.server"
import {
	getDisplayFields,
	getServiceCards,
	getTitleCards,
} from "~/server/title-cards.server"
import { INCOMPLETE_PAGE_HEADERS } from "~/server/incomplete-page"
import { getTitleSnapshot } from "~/server/title-snapshot/index.server"
import {
	type ViewerContext,
	getViewerContext,
} from "~/server/viewer.server"
import type { TvHomeData, TvService } from "~/ui/living-room/tv/tv-home"
import { TONIGHT_PICKS } from "~/ui/living-room/tv/tv-machine"
import { titleKey } from "~/utils/title-key"
import { livingRoomAuth } from "./data.server"
import { loadTvPopular } from "./tv-popular.server"
import { loadStartTitlesAndPicture } from "./start-titles.server"
import {
	guestHome,
	memberHome,
	tonightShowIds,
	tvServices,
} from "./tv-home.server"

/**
 * A member's two services: their first two saved services (their ids, in the order they saved them), one per
 * brand, filled up with Netflix and Prime Video. Never fails: what cannot be read is filled up the same way.
 */
export async function loadTvServices(
	saved: readonly number[],
): Promise<TvService[]> {
	const own = saved.length
		? await getServiceCards([...saved]).catch((error) => {
				console.error("The TV: loading a member's services failed", error)
				return []
			})
		: []
	return tvServices(own)
}

/** A member's Tonight and My shows: one read of what home's doors read, and the cards of the shows Tonight names. */
export async function loadMemberHome(
	viewer: ViewerContext,
	taste: Taste,
	now = Date.now(),
) {
	// Watch next's stack: the Next episode, then the first movies, then a show to start (tv-home.server.ts).
	const parts = await getTonightParts(viewer, taste, now, {
		movies: TONIGHT_PICKS - 2,
	})
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
	const start = loadStartTitlesAndPicture(
		getTitleSnapshot(),
		getDisplayFields,
	).then((start) => {
		if (!start.titles.length)
			headers.set("Cache-Control", INCOMPLETE_PAGE_HEADERS["Cache-Control"])
		return start
	})
	// Read the shared ranking alongside the start titles, so it is ready in the server HTML.
	const talked = talkedAboutNowEnabled("row", user?.id)
		? getTalkedAboutNow()
		: Promise.resolve(null)
	if (!user)
		return { data: { ...guestHome(await start), talked: await talked }, headers }

	// A member's home works without Tonight and My shows: the tiles are there and Tonight falls back to the pool's
	// best, as for a guest. So a failed read leaves that, not an error page.
	const viewer = getViewerContext(request, undefined, user.id)
	// A member's own services; without their settings, Netflix and Prime Video.
	const services = viewer
		.then((v) => loadTvServices(v.services))
		.catch(() => tvServices([]))
	const taste = loadMemberTaste(user.id)
	const popular = Promise.all([viewer, taste])
		.then(([v, t]) => loadTvPopular(v, t))
		.catch((error): NonNullable<TvHomeData["popular"]> => {
			console.error("The TV: loading popular titles failed", error)
			return { titles: [], scope: "unknown", country: "", failed: true }
		})
	const own = (async () => {
		const [t, v] = await Promise.all([taste, viewer])
		return {
			...(await loadMemberHome(v, t)),
			// What the Discover page's loader hands its search (`searchScope`), for the TV's.
			scope: { country: v.country, services: v.services },
		}
	})().catch((error): Pick<TvHomeData, "tonight" | "shows" | "scope" | "homeFailed"> => {
		console.error(
			"The TV: loading a member's Tonight and My shows failed",
			error,
		)
		return { tonight: [], shows: { next: [], start: [] }, homeFailed: true }
	})
	const data: TvHomeData = {
		...guestHome(await start, await services),
		member: true,
		...(await own),
		talked: await talked,
		popular: await popular,
	}
	return { data, headers }
}

async function canonicalHomeLoader({ request }: { request: Request }) {
	const { data, headers } = await loadTvHome(request)
	return json(data, { headers })
}

export const tvHomeLoader = presentCatalogLoader(canonicalHomeLoader, { live: true })
