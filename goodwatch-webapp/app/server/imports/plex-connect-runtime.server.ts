import { getAuthFromRequest } from "~/utils/auth"
import { onShutdown } from "../lifecycle.server.ts"
import { processRole } from "../role.server.ts"
import { siteOrigin } from "../site-origin.server.ts"
import { createConnectionStore } from "./connect-store.server.ts"
import { createPlexClient } from "./plex-client.server.ts"
import { createPlexConnect } from "./plex-connect.server.ts"

export const plexConnect = createPlexConnect({
	store: createConnectionStore(
		() => process.env.TMDB_CONNECT_KEY ?? "",
		() => process.env.TMDB_CONNECT_PREVIOUS_KEY ?? "",
		"plex",
	),
	client: createPlexClient(),
	origin: siteOrigin,
	member: async (request) => {
		const { user, headers } = await getAuthFromRequest({ request })
		return { userId: user?.id ?? null, headers }
	},
})
let timer: ReturnType<typeof setTimeout> | undefined
let stopped = false
export function startPlexConnectionCleanup() {
	if (timer || !process.env.TMDB_CONNECT_KEY || processRole() === "search")
		return
	stopped = false
	const tick = async () => {
		try {
			await plexConnect.sweep()
		} catch {
			console.error(
				"Plex connection cleanup is unavailable; cleanup will retry.",
			)
		}
		if (!stopped) {
			timer = setTimeout(tick, 60_000)
			timer.unref()
		}
	}
	timer = setTimeout(tick, 1000)
	timer.unref()
	onShutdown("plex-connect-cleanup", () => {
		stopped = true
		clearTimeout(timer)
		timer = undefined
	})
}
