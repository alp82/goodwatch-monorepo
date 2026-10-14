// The loader of the start page with the new TV (docs/implementation/tv-screen-revamp, section 3). Until the
// switch only /home-preview uses it; `/` keeps `loadLivingRoom` (server/living-room.server.ts).
//
// A guest gets the titles below the room and one picture, the first start title's backdrop: nothing personal, so
// the HTML is the same for every guest. A member gets Tonight and My shows from `getTonightParts`, the read home's
// doors use (tv-home.server.ts shapes them). Nothing here reads the Wishlist's cards: the new TV shows no count
// of them.
//
// Both get the two streaming services the Remote's keys and home's tiles stand for. A guest's are Netflix and
// Prime Video, read from nowhere, so a guest's HTML stays the same for every guest. A member's are their first two
// saved services (`loadTvServices`), filled up with Netflix and Prime Video.
import { json } from "@remix-run/node"
import { getLocaleFromRequest } from "~/server/cache-identity.server"
import { getTonightParts } from "~/server/home-doors.server"
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
	headers.set("Cache-Control", PRIVATE_CACHE_CONTROL)
	const start = loadStartTitlesAndPicture(getTitleSnapshot(), getDisplayFields)
	if (!user) return { data: guestHome(await start), headers }

	// A member's home works without Tonight and My shows: the tiles are there and Tonight falls back to the pool's
	// best, as for a guest. So a failed read leaves that, not an error page.
	const country = getLocaleFromRequest(request).locale.country
	const viewer = getMemberViewerContext(user.id, country)
	// A member's own services; without their settings, Netflix and Prime Video.
	const services = viewer
		.then((v) => loadTvServices(v.services))
		.catch(() => tvServices([]))
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
