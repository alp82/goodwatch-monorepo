import { json } from "@remix-run/node"
import { getLocaleFromRequest } from "~/server/cache-identity.server"
import { isEnabled } from "~/server/features.server"
import { getHomeDoors } from "~/server/home-doors.server"
import { loadMemberTaste } from "~/server/taste/member.server"
import { getDisplayFields, getServiceCards } from "~/server/title-cards.server"
import { getTitleSnapshot } from "~/server/title-snapshot/index.server"
import { getUserSettings } from "~/server/user-settings.server"
import {
	type ViewerContext,
	getMemberViewerContext,
} from "~/server/viewer.server"
import type {
	LivingRoomData,
	StartLink,
} from "~/ui/living-room/living-room-data"
import { poolCandidates, selectPoolKeys } from "./living-room/pool-keys.server"
import { livingRoomAuth } from "./living-room/data.server"
import { livingRoomWishlistCards } from "./living-room/pool.server"
import { loadLivingRoomWishlist } from "./living-room/wishlist.server"

const START_LINKS = 16

/**
 * PROTOTYPE (#352): the pool's first titles for a visitor nobody knows anything about, by popularity. No country,
 * no viewer: the same list for everyone. Empty while the snapshot loads.
 */
async function startLinks(
	posters: boolean,
	years: boolean,
): Promise<StartLink[]> {
	try {
		const snapshot = getTitleSnapshot()
		if (!snapshot) return []
		const none = new Set<number>()
		const { keys } = selectPoolKeys(
			poolCandidates(snapshot, Math.floor(Date.now() / 86_400_000)),
			{ seen: none, skipped: none, hidden: none, wishlist: none },
			null,
		)
		const wanted = keys.slice(0, START_LINKS)
		const displays = await getDisplayFields(wanted)
		return wanted.flatMap((key) => {
			const d = displays.get(key)
			if (!d) return []
			return [
				{
					media_type: d.media_type,
					tmdb_id: d.tmdb_id,
					title: d.title,
					...(posters && { poster_path: d.poster_path }),
					...(years && { release_year: d.release_year }),
				},
			]
		})
	} catch (error) {
		console.error("Living room: loading the start links failed", error)
		return []
	}
}

/** First paint never selects picks. Guests need only the shared empty UI contract. */
export async function loadLivingRoom(request: Request) {
	const { user, headers } = await livingRoomAuth(request)
	const country = getLocaleFromRequest(request).locale.country
	const data: LivingRoomData = {
		member: !!user,
		suggestions: [],
		wishlist: [],
		catalog: [],
		savedServices: [],
		pairs: [],
	}
	if (!user) {
		// PROTOTYPE (#352): only with `?links=`, so `/` without it is today's HTML.
		const variant = new URL(request.url).searchParams.get("links")
		if (
			variant === "strip" ||
			variant === "scroll" ||
			variant === "scroll2" ||
			variant === "tv"
		)
			data.startLinks = await startLinks(
				variant === "tv",
				variant.startsWith("scroll"),
			)
		return { data, headers }
	}
	try {
		const [taste, wishlist, settings] = await Promise.all([
			loadMemberTaste(user.id),
			loadLivingRoomWishlist(user.id, getTitleSnapshot()),
			getUserSettings({ userId: user.id }),
		])
		const savedCountry = settings.country_default?.toUpperCase()
		const services = (settings.streaming_providers_default ?? "")
			.split(",")
			.map(Number)
			.filter((id) => Number.isSafeInteger(id) && id > 0)
		const viewer: ViewerContext = {
			viewer: { kind: "member", userId: user.id },
			country:
				savedCountry && /^[A-Z]{2}$/.test(savedCountry)
					? savedCountry
					: country,
			services,
			seen: new Set(),
			skipped: new Set(),
			notInterested: new Set(),
			hidden: new Set(),
			ratings: new Map(),
			wishlist: new Map(wishlist.keys.map((key) => [key, new Date(0)])),
			forYou: settings.for_you !== "no",
		}
		const [cards, saved] = await Promise.all([
			livingRoomWishlistCards(viewer, taste),
			getServiceCards(services),
		])
		data.wishlist = cards
		data.catalog = saved
		data.savedServices = saved.map((service) => service.name)
		// With REC_TRACKING the member's home has three doors (#385). Without them it is today's two tiles, which is
		// also what a failed read leaves.
		if (isEnabled("tracking", { userId: user.id }))
			try {
				data.doors = await getHomeDoors(
					await getMemberViewerContext(user.id, country),
					taste,
				)
			} catch (error) {
				console.error("Living room: loading the doors failed", error)
			}
	} catch (error) {
		console.error("Living room: loading member data failed", error)
		throw json(
			{ error: "Unable to load living room data" },
			{ status: 503, headers },
		)
	}
	return { data, headers }
}

export async function livingRoomLoader({ request }: { request: Request }) {
	const { data, headers } = await loadLivingRoom(request)
	return json(data, { headers })
}
