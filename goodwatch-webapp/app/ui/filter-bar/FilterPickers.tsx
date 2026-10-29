// Quick title search shared by the Discover bar's Titles tab and Find.
import { useQuery } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import useLocale from "~/utils/locale"
import { mediaLanguageUrl } from "~/utils/media-presentation"
import { type TitleKey, titleKey } from "~/utils/title-key"

/** Typing waits a moment before it asks. */
function useDebounced<T>(value: T, ms = 220): T {
	const [v, setV] = useState(value)
	useEffect(() => {
		const id = setTimeout(() => setV(value), ms)
		return () => clearTimeout(id)
	}, [value, ms])
	return v
}

export interface Found {
	key: TitleKey
	title: string
	year: string
	poster: string | null
}

/** The site's quick title search (the header's typeahead): about a quarter second, where /api/similar-media takes 1.6 s. */
export function useQuickTitles(text: string) {
	const term = useDebounced(text.trim())
	const { locale } = useLocale()
	const q = useQuery<{
		query: string
		more: boolean
		searchResults: {
			id: number
			media_type: "movie" | "show"
			title?: string
			name?: string
			release_date?: string
			first_air_date?: string
			poster_path?: string | null
		}[]
	}>({
		queryKey: ["filter-title-search", term, locale.language],
		queryFn: async ({ signal }) => {
			const response = await fetch(
				mediaLanguageUrl(
					`/api/search?query=${encodeURIComponent(term)}`,
					locale.language,
				),
				{ signal },
			)
			return { ...(await response.json()), query: term }
		},
		enabled: term.length >= 2,
		placeholderData: (previous) => previous,
	})
	const results = term.length >= 2 ? (q.data?.searchResults ?? []) : []
	const found: Found[] = results.map((r) => ({
		key: titleKey(r.media_type, r.id),
		title: r.title ?? r.name ?? "",
		year: (r.release_date ?? r.first_air_date ?? "").slice(0, 4),
		poster: r.poster_path ?? null,
	}))
	return {
		found,
		/** The text these retained rows answer, including while the next text debounces. */
		query: q.data?.query ?? null,
		/** Pagination is measured before people are removed from the mixed page. */
		full: term.length >= 2 && q.data?.more === true,
		loading: text.trim().length >= 2 && (q.isFetching || term !== text.trim()),
	}
}
