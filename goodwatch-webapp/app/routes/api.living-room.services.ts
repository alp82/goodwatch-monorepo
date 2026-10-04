import { type LoaderFunctionArgs, json } from "@remix-run/node"
import {
	CACHE_IDENTITY_HEADER,
	getLocaleFromRequest,
	requestLocale,
} from "~/server/cache-identity.server"
import {
	PRIVATE_CACHE_CONTROL,
	SHARED_PAGE_CACHE_CONTROL,
	livingRoomServices,
} from "~/server/living-room/data.server"

// Public metadata only, independent of identity and saved preferences.
export async function loader({ request }: LoaderFunctionArgs) {
	const country = (
		new URL(request.url).searchParams.get("country") ??
		getLocaleFromRequest(request).locale.country
	).toUpperCase()
	const headers = new Headers({
		"Cache-Control": SHARED_PAGE_CACHE_CONTROL,
	})
	if (!new URL(request.url).searchParams.has("country")) {
		headers.set(
			"Vary",
			requestLocale(request).source === "identity-header"
				? CACHE_IDENTITY_HEADER
				: "Accept-Language",
		)
	}
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
