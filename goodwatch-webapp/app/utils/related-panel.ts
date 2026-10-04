// The related titles section of a title page shows one panel at a time: "overall", or one of the
// title's fingerprint highlight keys. A panel is one query in the browser and one request to
// /api/related. The server prefetch in related.server uses the same key, so the default panel
// arrives with the document and the browser doesn't request it again.

export const OVERALL_PANEL = "overall"

type MediaType = "movie" | "show"

/** What a related title card shows. Nothing else is embedded in the HTML or sent by the endpoint. */
export interface RelatedCard {
	tmdb_id: number
	title: string
	release_year: string
	poster_path: string
	goodwatch_overall_score_normalized_percent: number
}

export interface RelatedPanel {
	movies: RelatedCard[]
	shows: RelatedCard[]
}

export interface RelatedPanelParams {
	tmdbId: number
	sourceMediaType: MediaType
	/** Missing for the overall panel. The server looks up the source title's score for the key. */
	fingerprintKey?: string
}

export interface RelatedPanelSource {
	mediaType: MediaType
	details: { tmdb_id: number }
	fingerprint?: {
		highlightKeys?: string[]
	} | null
}

/** The section's tabs, in order. The first one is the default selection. */
export const relatedPanelKeys = (
	fingerprint: RelatedPanelSource["fingerprint"],
): string[] => [OVERALL_PANEL, ...(fingerprint?.highlightKeys ?? [])]

/** A selection made on another title stays only if this title has that panel too. */
export const activeRelatedPanelKey = (
	keys: string[],
	selectedKey: string,
): string => (keys.includes(selectedKey) ? selectedKey : OVERALL_PANEL)

export const relatedPanelParams = (
	media: RelatedPanelSource,
	panelKey: string,
): RelatedPanelParams => {
	const params: RelatedPanelParams = {
		tmdbId: media.details.tmdb_id,
		sourceMediaType: media.mediaType,
	}
	if (panelKey === OVERALL_PANEL) return params
	return { ...params, fingerprintKey: panelKey }
}

export const queryKeyRelatedPanel = ["related-panel"]

export const getQueryKeyRelatedPanel = ({
	tmdbId,
	sourceMediaType,
	fingerprintKey,
}: RelatedPanelParams) =>
	queryKeyRelatedPanel.concat([
		tmdbId.toString(),
		sourceMediaType,
		fingerprintKey ?? OVERALL_PANEL,
	])

// One request per panel: /api/related answers with the movies and the shows. The URL holds only
// the title and the panel, so a title has a small, fixed set of URLs that a shared cache can keep.
export const relatedPanelUrl = ({
	tmdbId,
	sourceMediaType,
	fingerprintKey,
}: RelatedPanelParams): string => {
	const search = new URLSearchParams({
		tmdbId: tmdbId.toString(),
		sourceMediaType,
	})
	if (fingerprintKey) search.set("fingerprintKey", fingerprintKey)
	return `/api/related?${search}`
}

const fetchRelatedPanel = async (
	params: RelatedPanelParams,
): Promise<RelatedPanel> => {
	const response = await fetch(relatedPanelUrl(params))
	if (!response.ok)
		throw new Error(`Related titles request failed: ${response.status}`)
	return await response.json()
}

// Related titles don't depend on the viewer, and the server keeps them for a day. A panel that
// is in the browser's query cache is never requested again: not on a return to its tab, not on
// window focus, and not when the page itself came from a cache and its embedded data is old.
// A panel nobody looks at leaves the query cache after 30 minutes.
export const RELATED_PANEL_STALE_TIME = Number.POSITIVE_INFINITY
export const RELATED_PANEL_GC_TIME = 30 * 60 * 1000

/** Options for `useQuery` and for `prefetchQuery` on intent, so both share one cache entry. */
export const relatedPanelQueryOptions = (params: RelatedPanelParams) => ({
	queryKey: getQueryKeyRelatedPanel(params),
	queryFn: () => fetchRelatedPanel(params),
	staleTime: RELATED_PANEL_STALE_TIME,
	gcTime: RELATED_PANEL_GC_TIME,
})

type RelatedTitleFields = RelatedCard & {
	goodwatch_overall_score_voting_count?: number
}

// The two titles with the most votes come first, the rest keep the order of the lookup.
const widelyKnownFirst = <T extends RelatedTitleFields>(titles: T[]): T[] => {
	const top = [...titles]
		.sort(
			(a, b) =>
				(b.goodwatch_overall_score_voting_count ?? 0) -
				(a.goodwatch_overall_score_voting_count ?? 0),
		)
		.slice(0, 2)
	const topIds = new Set(top.map((title) => title.tmdb_id))
	return [...top, ...titles.filter((title) => !topIds.has(title.tmdb_id))]
}

const toRelatedCard = (title: RelatedTitleFields): RelatedCard => ({
	tmdb_id: title.tmdb_id,
	title: title.title,
	release_year: title.release_year,
	poster_path: title.poster_path,
	goodwatch_overall_score_normalized_percent:
		title.goodwatch_overall_score_normalized_percent,
})

/** The panel as the page shows it: the cards in display order, with the fields a card reads. */
export const toRelatedPanel = ({
	movies,
	shows,
}: {
	movies: RelatedTitleFields[]
	shows: RelatedTitleFields[]
}): RelatedPanel => ({
	movies: widelyKnownFirst(movies).map(toRelatedCard),
	shows: widelyKnownFirst(shows).map(toRelatedCard),
})
