// The title as the page shows it for a country and language other than the ones it loaded with: a preview of a pick
// in the header pair, or a kept pair the page has not reloaded for. It only reads; nothing is saved and the address
// stays as it is.
import { useQuery } from "@tanstack/react-query"
import type { MovieResult, ShowResult } from "~/server/types/details-types"

type Media = MovieResult | ShowResult

export interface TitlePreviewParams {
	mediaType: "movie" | "show"
	tmdbId: number
	country: string
	/** The language the titles show in (a code, never "browser"). */
	language: string
	signal?: AbortSignal
}

export type TitlePreviewFetcher = (params: TitlePreviewParams) => Promise<Media>

const ROUTE_ID = {
	movie: "routes/movie.$movieKey",
	show: "routes/show.$showKey",
}

/**
 * The title route's own data for the country and language. The route reads `?language=` but does not localize yet,
 * so a language preview shows the canonical text until the backend's overlay exists; a country preview gets that
 * country's offers. A dedicated localized title payload can replace this fetcher without touching the page.
 */
export const routeDataFetcher: TitlePreviewFetcher = async ({
	mediaType,
	tmdbId,
	country,
	language,
	signal,
}) => {
	const path = window.location.pathname.startsWith(`/${mediaType}/`)
		? window.location.pathname
		: `/${mediaType}/${tmdbId}`
	const query = new URLSearchParams({
		country,
		language,
		_data: ROUTE_ID[mediaType],
	})
	const response = await fetch(`${path}?${query}`, { signal })
	// A redirect answers 204 with the target in a header: not the title's data.
	if (!response.ok || response.status === 204)
		throw new Error("Could not load the title for this country and language")
	const data = await response.json()
	return data.media as Media
}

export function useTitlePreview({
	media,
	loaded,
	want,
	fetcher = routeDataFetcher,
}: {
	media: Media
	/** The country and language the page loaded with. */
	loaded: { country: string; language: string }
	want: { country: string; language: string }
	fetcher?: TitlePreviewFetcher
}): { media: Media; loading: boolean; failed: boolean } {
	const differs =
		want.country !== loaded.country || want.language !== loaded.language
	const tmdbId = media.details.tmdb_id
	const preview = useQuery({
		queryKey: [
			"title-preview",
			media.mediaType,
			tmdbId,
			want.country,
			want.language,
		],
		queryFn: ({ signal }) =>
			fetcher({ mediaType: media.mediaType, tmdbId, ...want, signal }),
		enabled: differs,
		staleTime: 5 * 60_000,
		retry: 1,
	})
	if (!differs) return { media, loading: false, failed: false }
	// Until its own data is in, the page shows what it loaded with and says it is loading.
	return {
		media: preview.data ?? media,
		loading: !preview.data && !preview.isError,
		failed: preview.isError,
	}
}
