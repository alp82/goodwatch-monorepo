import { siteOrigin } from "../site-origin.server.ts"
import { connectMember, connectionCleanup } from "./connect-runtime.server.ts"
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
	member: connectMember,
})
export const startPlexConnectionCleanup = connectionCleanup(
	"plex",
	() => plexConnect.sweep(),
	() => !!process.env.TMDB_CONNECT_KEY,
	"Plex connection cleanup is unavailable; cleanup will retry.",
)
