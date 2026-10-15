import { getAuthFromRequest } from "~/utils/auth"
import { onShutdown } from "../lifecycle.server.ts"
import { processRole } from "../role.server.ts"
import { siteOrigin } from "../site-origin.server.ts"
import { createConnectionStore } from "./connect-store.server.ts"
import { createTmdbClient } from "./tmdb-client.server.ts"
import { createTmdbConnect } from "./tmdb-connect.server.ts"

export const tmdbConnect = createTmdbConnect({
	store: createConnectionStore(
		() => process.env.TMDB_CONNECT_KEY ?? "",
		() => process.env.TMDB_CONNECT_PREVIOUS_KEY ?? "",
	),
	client: createTmdbClient({ appToken: process.env.TMDB_API_TOKEN ?? "" }),
	origin: siteOrigin,
	member: async (request) => {
		const { user, headers } = await getAuthFromRequest({ request })
		return { userId: user?.id ?? null, headers }
	},
})
let timer: ReturnType<typeof setTimeout> | undefined
let stopped = false
export function startTmdbConnectionCleanup() {
	if (
		timer ||
		!process.env.TMDB_API_TOKEN ||
		!process.env.TMDB_CONNECT_KEY ||
		processRole() === "search"
	)
		return
	stopped = false
	const tick = async () => {
		try {
			await tmdbConnect.sweep()
		} catch {
			console.error(
				"TMDB connection cleanup is unavailable; credentials remain queued for retry.",
			)
		}
		if (!stopped) {
			timer = setTimeout(tick, 60_000)
			timer.unref()
		}
	}
	timer = setTimeout(tick, 1000)
	timer.unref()
	onShutdown("tmdb-connect-cleanup", () => {
		stopped = true
		clearTimeout(timer)
		timer = undefined
	})
}
