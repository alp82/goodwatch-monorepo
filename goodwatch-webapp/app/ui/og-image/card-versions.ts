import { WATCH_PATHS } from "../../domain/member-paths.ts"
// Versions of single Open Graph cards, by canonical page path (server/og-image/content.server.ts, `canonicalOgPath`).
// Bump a path's version when only that card's design or words change: its stored card is drawn again (the store's
// key, server/og-image/store.server.ts) and its image address changes (utils/og-image-url.ts), so link previews fetch
// it again. Every other card keeps its stored image. CACHE_PREFIX and WORDMARK_VERSION are for changes to all cards.
// Plain relative imports only: the browser, the server and node tests read it.

export const CARD_VERSIONS: Readonly<Record<string, number>> = {
	[WATCH_PATHS.nextEpisodes]: 1,
	[WATCH_PATHS.tonight]: 1,
	[WATCH_PATHS.forYou]: 1,
	// Explorer prints the renamed Trippy mood; its preview needs a new image address.
	"/map": 2,
	// 2: the lit taste bar (owner, October 28, 2026).
	"/taste/quiz": 2,
}

/** The card version of a canonical path, or null for a card that has never had its own. */
export const cardVersion = (path: string): number | null =>
	CARD_VERSIONS[path] ?? null

/** The suffix a versioned card's store key and image address carry: "" for a card without its own version. */
export const cardVersionSuffix = (path: string, separator: string) => {
	const version = cardVersion(path)
	return version == null ? "" : `${separator}${version}`
}
