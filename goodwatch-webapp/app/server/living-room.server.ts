import { json } from "@remix-run/node"
import { loadMemberTaste } from "~/server/taste/member.server"
import { getServiceCards } from "~/server/title-cards.server"
import { getTitleSnapshot } from "~/server/title-snapshot/index.server"
import { getUserSettings } from "~/server/user-settings.server"
import type { ViewerContext } from "~/server/viewer.server"
import type { LivingRoomData } from "~/ui/living-room/living-room-data"
import { getLocaleFromRequest } from "~/utils/locale"
import { livingRoomAuth } from "./living-room/data.server"
import { livingRoomWishlistCards } from "./living-room/pool.server"
import { loadLivingRoomWishlist } from "./living-room/wishlist.server"

/** First paint never selects picks. Guests need only the shared empty UI contract. */
export async function loadLivingRoom(request: Request) {
	const { user, headers } = await livingRoomAuth(request)
	const localeCountry = getLocaleFromRequest(request).locale.country
	const country = /^[A-Z]{2}$/.test(localeCountry) ? localeCountry : "DE"
	const data: LivingRoomData = {
		member: !!user,
		suggestions: [],
		wishlist: [],
		catalog: [],
		savedServices: [],
		pairs: [],
	}
	if (!user) return { data, headers }
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
