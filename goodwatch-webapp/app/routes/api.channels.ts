import { json, type LoaderFunctionArgs } from "@remix-run/node"
import {
	applyCachePolicy,
	PRIVATE_CACHE_CONTROL,
} from "~/server/cache-identity.server"
import { loadChannels } from "~/server/channels.server"
import { livingRoomAuth } from "~/server/living-room/data.server"
import { getTitleSnapshot } from "~/server/title-snapshot/index.server"
import { getViewerCountry } from "~/server/viewer.server"

export async function loader({ request }: LoaderFunctionArgs) {
	const snapshot = getTitleSnapshot()
	if (!snapshot)
		return json(
			{ error: "Title snapshot is loading" },
			{
				status: 503,
				headers: { "Retry-After": "2", "Cache-Control": PRIVATE_CACHE_CONTROL },
			},
		)
	const { user, headers } = await livingRoomAuth(request)
	try {
		const country = await getViewerCountry(request, user?.id ?? null)
		const path = (new URL(request.url).searchParams.get("path") ?? "").slice(
			0,
			300,
		)
		const result = await loadChannels(snapshot, country, path)
		applyCachePolicy(request, 200, headers)
		return json(result, { headers })
	} catch (error) {
		console.error("Channels: cached catalog read failed", error)
		headers.set("Cache-Control", PRIVATE_CACHE_CONTROL)
		headers.set("Retry-After", "2")
		return json({ error: "Unable to load channels" }, { status: 503, headers })
	}
}
