import { json } from "@remix-run/node"
import {
	type LivingRoomData,
	emptyLivingRoomContext,
} from "~/domain/living-room"
import {
	getStreamingProviders,
	slimStreamingProviders,
} from "~/server/streaming-providers.server"
import { loadMemberTaste } from "~/server/taste/member.server"
import { getTitleSnapshot } from "~/server/title-snapshot/index.server"
import { getUserSettings } from "~/server/user-settings.server"
import { getAuthFromRequest } from "~/utils/auth"
import { getLocaleFromRequest } from "~/utils/locale"
import { parseTitleKey } from "~/utils/title-key"
import { loadLivingRoomWishlist } from "./wishlist.server"

export const PRIVATE_CACHE_CONTROL = "private, no-store"
export const GUEST_CACHE_CONTROL =
	"public, max-age=0, s-maxage=1800, stale-while-revalidate=7200"

export function tvTitleKey(key: number): string {
	const { mediaType, tmdbId } = parseTitleKey(key)
	return `${mediaType}-${tmdbId}`
}

/** Keep auth refresh cookies, and never make an invalid/expired auth-cookie response public. */
export async function livingRoomAuth(request: Request) {
	const auth = await getAuthFromRequest({ request })
	if (
		auth.user ||
		auth.headers.has("Set-Cookie") ||
		auth.headers.get("Cache-Control")?.includes("private")
	) {
		auth.headers.set("Cache-Control", PRIVATE_CACHE_CONTROL)
	} else auth.headers.set("Cache-Control", GUEST_CACHE_CONTROL)
	return auth
}

export async function livingRoomServices(
	country: string,
	include: number[] = [],
) {
	const providers = slimStreamingProviders(
		await getStreamingProviders({ country }),
		country,
		include,
	)
	const names = new Set<string>()
	return providers
		.filter(({ name }) => {
			if (names.has(name)) return false
			names.add(name)
			return true
		})
		.map(({ id, name, logo_path }) => ({ id, name, logo_path }))
}

/**
 * Page loader for #229/#234. Guests read no member data, providers, cards, or picks.
 *
 * SSR: re-export livingRoomLoader as loader, or call loadLivingRoom(request) and pass its headers to json.
 * Re-export pageHeaders from ~/utils/headers for the HTML response; it keeps the root's member policy.
 * Use isTvOnlyChange in shouldRevalidate so moving around the TV does not reload member data.
 *
 * After hydration: fetch /api/living-room/services?country=DE when the services screen opens, and
 * /api/living-room/picks when picks open (TanStack Query, using the global freshness defaults).
 * livingRoomContext(data, progress) overlays returned pickKeys/serviceNames and local quiz progress.
 * answered/pairsLeft describe this-or-that answers, never the member's historical ratings. #226 owns them.
 */
export async function loadLivingRoom(request: Request) {
	const { user, headers } = await livingRoomAuth(request)
	const localeCountry = getLocaleFromRequest(request).locale.country
	const country = /^[A-Z]{2}$/.test(localeCountry) ? localeCountry : "DE"
	const data: LivingRoomData = {
		context: emptyLivingRoomContext(),
		country,
		services: [],
		selectedServiceIds: [],
		wishlistTotal: 0,
		wishlistMoodCounts: null,
		taste: { signal: "none", ratings: 0, liked: 0 },
	}
	if (!user) return { data, headers }
	try {
		const [taste, wishlist, settings] = await Promise.all([
			loadMemberTaste(user.id),
			loadLivingRoomWishlist(user.id, getTitleSnapshot()),
			getUserSettings({ userId: user.id }),
		])
		const savedCountry = settings.country_default?.toUpperCase()
		if (savedCountry && /^[A-Z]{2}$/.test(savedCountry))
			data.country = savedCountry
		data.selectedServiceIds = (settings.streaming_providers_default ?? "")
			.split(",")
			.map(Number)
			.filter((id) => Number.isSafeInteger(id) && id > 0)
		data.services = await livingRoomServices(
			data.country,
			data.selectedServiceIds,
		)
		const matches = taste.match(wishlist.keys)
		const ordered = wishlist.keys.map((key, i) => ({
			key,
			match: matches[i] ?? 0,
		}))
		ordered.sort((a, b) => b.match - a.match)
		data.context = {
			...data.context,
			member: true,
			wishlistKeys: ordered.slice(0, 6).map(({ key }) => tvTitleKey(key)),
			serviceNames: data.services.map(({ name }) => name),
			hasServices: data.selectedServiceIds.length > 0,
		}
		data.wishlistTotal = wishlist.keys.length
		data.wishlistMoodCounts = wishlist.moodCounts
		data.taste = {
			signal: taste.signal,
			ratings: taste.ratings,
			liked: taste.liked,
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
