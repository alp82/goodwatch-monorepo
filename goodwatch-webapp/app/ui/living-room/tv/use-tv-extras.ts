// What a title brings beyond its card: the direct offers of its country (a Watch key opens the service in a new
// tab), its trailer and its fingerprint, from `/api/tv-title` (routes/api.tv-title.ts). One query per title, shared
// by the screens that show it: Watch next and Popular ask for the title on show, so its details open with them.
import { useQuery } from "@tanstack/react-query"
import useLocale from "~/utils/locale"
import { mediaLanguageUrl } from "~/utils/media-presentation"
import type { TvTitleExtras } from "./title-extras"
import { parseTvTitleKey } from "./tv-title"

export function useTvTitleExtras(key: string | null) {
	const { locale } = useLocale()
	const ref = key ? parseTvTitleKey(key) : null
	return useQuery<TvTitleExtras>({
		queryKey: ["tv-title-extras", key, locale.country, locale.language],
		enabled: Boolean(ref),
		queryFn: async ({ signal }) => {
			if (!ref) throw new Error("No title")
			const response = await fetch(
				mediaLanguageUrl(
					`/api/tv-title?type=${ref.mediaType}&id=${ref.tmdbId}&country=${locale.country}`,
					locale.language,
				),
				{ signal },
			)
			if (!response.ok) throw new Error("Title details unavailable")
			return response.json()
		},
	})
}
