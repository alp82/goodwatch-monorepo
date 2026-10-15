import useLocale from "~/utils/locale"
import { mediaLanguageUrl } from "~/utils/media-presentation"
// Title search for the share list editor: movies and shows, through /api/share-lists/titles.
import { useQuery } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import type { CardTitle } from "~/ui/share-card/model"

const DEBOUNCE_MS = 250
const MIN_LENGTH = 2

/** Results for the text, or null while the text is too short to search. */
export function useTitleSearch(text: string) {
	const { locale } = useLocale()
	const [query, setQuery] = useState(text.trim())
	useEffect(() => {
		const id = setTimeout(() => setQuery(text.trim()), DEBOUNCE_MS)
		return () => clearTimeout(id)
	}, [text])
	const enabled = query.length >= MIN_LENGTH
	const { data, isFetching } = useQuery({
		queryKey: ["share-list-title-search", query, locale.language],
		enabled,
		queryFn: async ({ signal }) => {
			const response = await fetch(
				mediaLanguageUrl(`/api/share-lists/titles?q=${encodeURIComponent(query)}`, locale.language),
				{ signal },
			)
			if (!response.ok) throw new Error(`Search failed (${response.status})`)
			const { titles } = (await response.json()) as { titles: CardTitle[] }
			return titles
		},
	})
	return {
		results: enabled ? (data ?? []) : null,
		loading: enabled && isFetching,
	}
}
