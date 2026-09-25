// SEARCH_RANKING_MODE switches the local search ranking on:
// - off (default): nothing in this folder loads models, reads indexes or calls Qdrant.
// - shadow: the new ranking runs next to the current search and is only logged.
// - on: the new ranking serves results, with the current one as the fallback (serve.server.ts).
export type SearchRankingMode = "off" | "shadow" | "on"

let warnedValue: string | undefined

export function getSearchRankingMode(): SearchRankingMode {
	const raw = (process.env.SEARCH_RANKING_MODE ?? "").trim().toLowerCase()
	if (raw === "shadow" || raw === "on") return raw
	if (raw && raw !== "off" && warnedValue !== raw) {
		warnedValue = raw
		console.warn(
			`SEARCH_RANKING_MODE="${raw}" is not off, shadow or on. Using off.`,
		)
	}
	return "off"
}

export function isSearchRankingEnabled(): boolean {
	return getSearchRankingMode() !== "off"
}

export function assertSearchRankingEnabled(feature: string): void {
	if (!isSearchRankingEnabled()) {
		throw new Error(`${feature} is disabled because SEARCH_RANKING_MODE is off`)
	}
}
