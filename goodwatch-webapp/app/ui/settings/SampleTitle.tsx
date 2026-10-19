// One title shown in the chosen titles language, so a member sees what the setting changes: Spirited Away, which has
// translations in every offered language. The Show titles in tile shows it as a small line, the page as a card. A
// title that comes back untranslated (sample-title.ts) isn't shown as the chosen language.
import { useQuery } from "@tanstack/react-query"
import { localizedTextFetcher } from "~/ui/media-preference/useTitlePreview"
import { localizedTitleQueryKey } from "~/utils/media-presentation"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import { titleIsIn } from "./sample-title"

const SAMPLE = { type: "movie", id: 129 } as const

export function useSampleTitle(language: string) {
	const sample = useQuery({
		queryKey: localizedTitleQueryKey(SAMPLE.type, SAMPLE.id, language),
		queryFn: ({ signal }) =>
			localizedTextFetcher({ mediaType: SAMPLE.type, tmdbId: SAMPLE.id, language, signal }),
		placeholderData: (previous) => previous,
	})
	return titleIsIn(sample.data?.presentation?.title, language) ? sample.data : null
}

/** A small poster and the title: for the tile. */
export function SampleTitleLine({ language }: { language: string }) {
	const title = useSampleTitle(language)
	if (!title) return null
	return (
		<span className="mt-4 flex items-center gap-3">
			{title.poster_path && (
				<img src={tmdbImageUrl(title.poster_path, "w92")} alt="" className="h-12 w-8 shrink-0 rounded object-cover shadow" />
			)}
			<span
				lang={title.presentation?.title?.language}
				dir="auto"
				className="min-w-0 truncate text-sm font-semibold text-gray-300"
			>
				{title.title}
			</span>
		</span>
	)
}

/** The poster, the title and the start of its description: for the page. */
export function SampleTitleCard({ language }: { language: string }) {
	const title = useSampleTitle(language)
	if (!title) return null
	const overview = titleIsIn(title.presentation?.overview, language) ? title.overview : null
	return (
		<div className="flex max-w-xl gap-3 rounded-xl bg-black/30 p-3 ring-1 ring-white/10" data-sample-title>
			{title.poster_path && (
				<img src={tmdbImageUrl(title.poster_path, "w154")} alt="" className="h-20 w-[3.35rem] shrink-0 rounded-md object-cover" />
			)}
			<div className="min-w-0">
				<p className="text-xs font-medium tracking-wide text-gray-500 uppercase">Preview</p>
				<p lang={title.presentation?.title?.language} dir="auto" className="truncate text-base font-bold text-white">
					{title.title}
				</p>
				{overview && (
					<p lang={title.presentation?.overview?.language} dir="auto" className="mt-1 line-clamp-2 text-sm text-gray-400">
						{overview}
					</p>
				)}
			</div>
		</div>
	)
}
