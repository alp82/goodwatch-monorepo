import { siteOrigin } from "../site-origin.server.ts"
import { connectMember, connectionCleanup } from "./connect-runtime.server.ts"
import { createConnectionStore } from "./connect-store.server.ts"
import { createTmdbClient } from "./tmdb-client.server.ts"
import { createTmdbConnect } from "./tmdb-connect.server.ts"

export const tmdbConnect = createTmdbConnect({
	store: createConnectionStore(
		() => process.env.TMDB_CONNECT_KEY ?? "",
		() => process.env.TMDB_CONNECT_PREVIOUS_KEY ?? "",
	),
	client: createTmdbClient({ apiKey: process.env.TMDB_API_KEY ?? "" }),
	origin: siteOrigin,
	member: connectMember,
})
export const startTmdbConnectionCleanup = connectionCleanup(
	"tmdb",
	() => tmdbConnect.sweep(),
	() => !!process.env.TMDB_CONNECT_KEY && !!process.env.TMDB_API_KEY,
	"TMDB connection cleanup is unavailable; credentials remain queued for retry.",
)
