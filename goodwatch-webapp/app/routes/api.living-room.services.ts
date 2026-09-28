import { type LoaderFunctionArgs, json } from "@remix-run/node"
import {
	GUEST_CACHE_CONTROL,
	PRIVATE_CACHE_CONTROL,
	livingRoomServices,
} from "~/server/living-room/data.server"
import { getLocaleFromRequest } from "~/utils/locale"

// Public metadata only, independent of identity and saved preferences.
export async function loader({ request }: LoaderFunctionArgs) {
	const country = (
		new URL(request.url).searchParams.get("country") ??
		getLocaleFromRequest(request).locale.country
	).toUpperCase()
	const headers = new Headers({
		"Cache-Control": GUEST_CACHE_CONTROL,
		Vary: "Accept-Language",
	})
	if (!/^[A-Z]{2}$/.test(country)) {
		headers.set("Cache-Control", PRIVATE_CACHE_CONTROL)
		return json({ error: "Invalid country" }, { status: 400, headers })
	}
	try {
		const services = await livingRoomServices(country)
		return json(
			{ country, services, serviceNames: services.map(({ name }) => name) },
			{ headers },
		)
	} catch (error) {
		console.error("Living room: loading services failed", error)
		headers.set("Cache-Control", PRIVATE_CACHE_CONTROL)
		return json({ error: "Unable to load services" }, { status: 503, headers })
	}
}
