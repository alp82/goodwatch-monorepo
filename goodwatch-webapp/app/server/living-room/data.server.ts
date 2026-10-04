import {
	getStreamingProviders,
	slimStreamingProviders,
} from "~/server/streaming-providers.server"
import { getAuthFromRequest } from "~/utils/auth"

import {
	PRIVATE_CACHE_CONTROL,
	SHARED_PAGE_CACHE_CONTROL,
} from "../cache-identity.server"
export {
	PRIVATE_CACHE_CONTROL,
	SHARED_PAGE_CACHE_CONTROL,
} from "../cache-identity.server"

/** Keep auth refresh cookies, and never make an invalid/expired auth-cookie response public. */
export async function livingRoomAuth(request: Request) {
	const auth = await getAuthFromRequest({ request })
	if (
		auth.user ||
		auth.headers.has("Set-Cookie") ||
		auth.headers.get("Cache-Control")?.includes("private")
	) {
		auth.headers.set("Cache-Control", PRIVATE_CACHE_CONTROL)
	} else auth.headers.set("Cache-Control", SHARED_PAGE_CACHE_CONTROL)
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
