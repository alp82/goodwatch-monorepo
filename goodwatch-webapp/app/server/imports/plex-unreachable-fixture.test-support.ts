import { createPlexClient } from "./plex-client.server.ts"

/** Three owned servers with no reachable connection, and a working personal watchlist feed. */
export const threeUnreachableServersWithFeed = () =>
	createPlexClient({
		http: async (input) => {
			const url = new URL(input)
			if (url.pathname === "/api/v2/resources")
				return {
					text: JSON.stringify(
						Array.from({ length: 3 }, (_, i) => ({
							owned: true,
							provides: "server",
							clientIdentifier: `server-${i}`,
							accessToken: "synthetic",
							connections: [
								{
									uri: `https://server-${i}.plex.direct`,
									local: false,
									relay: false,
								},
							],
						})),
					),
					headers: {},
				}
			if (url.hostname === "rss.plex.tv")
				return {
					text: "<rss><channel><item><title>Synthetic movie</title><category>movie</category><guid>tmdb://862</guid></item></channel></rss>",
					headers: {},
				}
			throw new Error("Synthetic server unavailable")
		},
	}).readImport(
		"synthetic",
		"test-client",
		"https://rss.plex.tv/watchlist/synthetic",
	)
