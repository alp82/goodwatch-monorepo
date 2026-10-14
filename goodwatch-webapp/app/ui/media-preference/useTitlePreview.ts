// The title as the page shows it for a country and language other than the ones it loaded with: a preview of a pick
// in the header pair, or a kept pair the page has not reloaded for. It only reads; nothing is saved and the address
// stays as it is.
import { useQuery } from "@tanstack/react-query"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import {
	type LocalizedTitlePayload,
	type LocalizedTitleResponse,
	localizedTitleQueryKey,
	localizedTitleUrl,
} from "~/utils/media-presentation"
import { needsText, textLanguage, withLocalizedText } from "./localized-preview"

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
 * The title route's own data for a country: that country's offers. The route takes its language from what is saved
 * (an address cannot change it), so a picked language comes from `localizedTextFetcher` instead.
 */
export const routeDataFetcher: TitlePreviewFetcher = async ({
	mediaType,
	tmdbId,
	country,
	signal,
}) => {
	const path = window.location.pathname.startsWith(`/${mediaType}/`)
		? window.location.pathname
		: `/${mediaType}/${tmdbId}`
	const query = new URLSearchParams({ country, _data: ROUTE_ID[mediaType] })
	const response = await fetch(`${path}?${query}`, { signal })
	// A redirect answers 204 with the target in a header: not the title's data.
	if (!response.ok || response.status === 204)
		throw new Error("Could not load the title for this country and language")
	const data = await response.json()
	return data.media as Media
}

/** The title's text in a titles language: the read-only localized payload, the same for every visitor. */
export const localizedTextFetcher = async ({
	mediaType,
	tmdbId,
	language,
	signal,
}: Omit<TitlePreviewParams, "country">): Promise<LocalizedTitlePayload> => {
	const response = await fetch(localizedTitleUrl(mediaType, tmdbId, language), {
		signal,
	})
	if (!response.ok) throw new Error("Could not load the title in this language")
	return ((await response.json()) as LocalizedTitleResponse).title
}

export type PreviewStatus = "loading" | "failed" | null

export function useTitlePreview({
	media,
	loadedCountry,
	want,
	fetcher = routeDataFetcher,
	textFetcher = localizedTextFetcher,
}: {
	media: Media
	/** The country the page loaded with. Its language is the one its text is in. */
	loadedCountry: string
	want: { country: string; language: string }
	fetcher?: TitlePreviewFetcher
	textFetcher?: typeof localizedTextFetcher
}): { media: Media; offers: PreviewStatus; text: PreviewStatus } {
	const tmdbId = media.details.tmdb_id
	// A country preview: the title route's data for it (its offers), in the language the page has saved.
	const otherCountry = want.country !== loadedCountry
	const preview = useQuery({
		// The route answers in the saved language: another saved language is other data.
		queryKey: ["title-preview", media.mediaType, tmdbId, want.country, textLanguage(media)],
		queryFn: ({ signal }) =>
			fetcher({ mediaType: media.mediaType, tmdbId, ...want, signal }),
		enabled: otherCountry,
		staleTime: 5 * 60_000,
		retry: 1,
	})
	// Until its own data is in (or when it fails), the page keeps what it loaded with and says so.
	const base = (otherCountry && preview.data) || media
	const offers: PreviewStatus = !otherCountry
		? null
		: preview.isError
			? "failed"
			: preview.data
				? null
				: "loading"

	// A language preview: the title's text in that language, over whichever data the page shows. One query per title
	// and language, so a late answer for an earlier pick lands in its own entry and is never shown.
	const otherText = needsText(base, want.language)
	const text = useQuery({
		queryKey: localizedTitleQueryKey(media.mediaType, tmdbId, want.language),
		queryFn: ({ signal }) =>
			textFetcher({ mediaType: media.mediaType, tmdbId, language: want.language, signal }),
		enabled: otherText,
		staleTime: 30 * 60_000,
		retry: 1,
	})
	if (!otherText) return { media: base, offers, text: null }
	const localized = withLocalizedText(base, text.data, want.language)
	return {
		media: localized ?? base,
		offers,
		text: localized ? null : text.isError ? "failed" : "loading",
	}
}
